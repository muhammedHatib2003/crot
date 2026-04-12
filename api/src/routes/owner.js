const express = require("express");
const prisma = require("../db");
const { hashPassword } = require("../utils/password");
const { authenticate, requireRoles } = require("../middleware/auth");
const { hasActiveSubscription, requireActiveSubscription } = require("../middleware/subscription");
const { ensureUniqueRestaurantSlug } = require("../utils/slugs");
const {
  InventoryError,
  approveRecipeForMenuItem,
  createIngredient,
  createManualStockMovement,
  deleteRecipeForMenuItem,
  getRecipeForMenuItem,
  listIngredientsWithStock,
  mapIngredient,
  runSerializableTransaction,
  updateIngredient,
  upsertRecipeForMenuItem
} = require("../services/inventory");
const { listMenuItems, mapMenuItem, MENU_ITEM_AVAILABILITY_INCLUDE } = require("../utils/menu");

const router = express.Router();
const ALLOWED_EMPLOYEE_ROLES = new Set(["chef", "cashier", "waiter", "inventory_manager"]);
const ALLOWED_TABLE_STATUSES = new Set(["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"]);

function mapRestaurant(restaurant) {
  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    phone: restaurant.phone,
    logoUrl: restaurant.logoUrl,
    publicOrderingEnabled: restaurant.publicOrderingEnabled,
    pickupEnabled: restaurant.pickupEnabled
  };
}

function mapTable(table) {
  return {
    id: table.id,
    name: table.name,
    seats: table.seats,
    status: table.status,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt
  };
}

function parsePriceToCents(rawPrice) {
  const parsed = Number(rawPrice);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

function parseStock(rawStock) {
  if (rawStock === undefined || rawStock === null || rawStock === "") {
    return { value: 0 };
  }

  const parsed = Number(rawStock);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { error: "stock must be a whole number greater than or equal to 0." };
  }

  return { value: parsed };
}

function parseCurrentStock(rawCurrentStock) {
  if (rawCurrentStock === undefined || rawCurrentStock === null || rawCurrentStock === "") {
    return { hasValue: false, value: 0 };
  }

  const parsed = Number(rawCurrentStock);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: "currentStock must be greater than or equal to 0." };
  }

  return {
    hasValue: true,
    value: Math.round(parsed * 1000) / 1000
  };
}

function normalizeOptionalHttpUrl(rawValue) {
  const trimmedValue = String(rawValue || "").trim();
  if (!trimmedValue) {
    return { value: null };
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { error: "logoUrl must start with http:// or https://." };
    }

    return { value: parsedUrl.toString() };
  } catch (error) {
    return { error: "logoUrl must be a valid URL." };
  }
}

function mapSubscription(subscription) {
  if (!subscription) {
    return null;
  }

  return {
    id: subscription.id,
    status: subscription.status,
    activatedAt: subscription.activatedAt,
    plan: {
      id: subscription.plan.id,
      code: subscription.plan.code,
      displayName: subscription.plan.displayName,
      monthlyPrice: subscription.plan.monthlyPrice
    }
  };
}

function handleInventoryError(res, error, next) {
  if (error instanceof InventoryError) {
    return res.status(error.status).json({
      message: error.message,
      details: error.details || undefined
    });
  }

  return next(error);
}

async function selectPlanSubscription(req, res, next) {
  try {
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ message: "planId is required." });
    }

    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      return res.status(404).json({ message: "Plan not found." });
    }

    const subscription = await prisma.subscription.upsert({
      where: {
        restaurantId: req.auth.restaurantId
      },
      update: {
        planId: plan.id,
        status: "ACTIVE",
        activatedAt: new Date()
      },
      create: {
        restaurantId: req.auth.restaurantId,
        planId: plan.id,
        status: "ACTIVE"
      },
      include: {
        plan: true
      }
    });

    return res.json({
      message: "Plan selected successfully.",
      requiresPlanSelection: false,
      subscription: mapSubscription(subscription)
    });
  } catch (error) {
    return next(error);
  }
}

router.use(authenticate, requireRoles("OWNER"));

router.get("/dashboard", async (req, res, next) => {
  try {
    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const [restaurant, employeeCount, tablesCount, menuItemsCount] = await Promise.all([
      prisma.restaurant.findUnique({
        where: { id: req.auth.restaurantId },
        include: {
          subscription: {
            include: {
              plan: true
            }
          }
        }
      }),
      prisma.user.count({
        where: {
          restaurantId: req.auth.restaurantId,
          systemRole: "EMPLOYEE"
        }
      }),
      prisma.diningTable.count({
        where: {
          restaurantId: req.auth.restaurantId
        }
      }),
      prisma.menuItem.count({
        where: {
          restaurantId: req.auth.restaurantId
        }
      })
    ]);

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    const requiresPlanSelection = !hasActiveSubscription(restaurant.subscription);

    return res.json({
      restaurant: mapRestaurant(restaurant),
      employeesCount: employeeCount,
      tablesCount,
      menuItemsCount,
      requiresPlanSelection,
      subscription: mapSubscription(restaurant.subscription)
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/restaurant", async (req, res, next) => {
  try {
    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const body = req.body || {};
    const hasLogoUrl = Object.prototype.hasOwnProperty.call(body, "logoUrl");
    const hasSlug = Object.prototype.hasOwnProperty.call(body, "slug");
    const hasPublicOrderingEnabled = Object.prototype.hasOwnProperty.call(body, "publicOrderingEnabled");
    const hasPickupEnabled = Object.prototype.hasOwnProperty.call(body, "pickupEnabled");

    if (!hasLogoUrl && !hasSlug && !hasPublicOrderingEnabled && !hasPickupEnabled) {
      return res
        .status(400)
        .json({ message: "Provide at least one of: logoUrl, slug, publicOrderingEnabled, pickupEnabled." });
    }

    const data = {};

    if (hasLogoUrl) {
      const { value: normalizedLogoUrl, error } = normalizeOptionalHttpUrl(body.logoUrl);
      if (error) {
        return res.status(400).json({ message: error });
      }
      data.logoUrl = normalizedLogoUrl;
    }

    if (hasSlug) {
      const normalizedSlug = String(body.slug || "").trim();
      if (!normalizedSlug) {
        return res.status(400).json({ message: "slug cannot be empty." });
      }

      data.slug = await ensureUniqueRestaurantSlug(prisma, normalizedSlug, req.auth.restaurantId);
    }

    if (hasPublicOrderingEnabled) {
      if (typeof body.publicOrderingEnabled !== "boolean") {
        return res.status(400).json({ message: "publicOrderingEnabled must be boolean." });
      }
      data.publicOrderingEnabled = body.publicOrderingEnabled;
    }

    if (hasPickupEnabled) {
      if (typeof body.pickupEnabled !== "boolean") {
        return res.status(400).json({ message: "pickupEnabled must be boolean." });
      }
      data.pickupEnabled = body.pickupEnabled;
    }

    const restaurant = await prisma.restaurant.update({
      where: { id: req.auth.restaurantId },
      data
    });

    return res.json({
      message: "Restaurant settings updated successfully.",
      restaurant: mapRestaurant(restaurant)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/subscription/select", selectPlanSubscription);
router.post("/subscription/activate", selectPlanSubscription);

router.use("/employees", requireActiveSubscription);
router.use("/tables", requireActiveSubscription);
router.use("/menu", requireActiveSubscription);
router.use("/inventory", requireActiveSubscription);

router.get("/employees", async (req, res, next) => {
  try {
    const employees = await prisma.user.findMany({
      where: {
        restaurantId: req.auth.restaurantId,
        systemRole: "EMPLOYEE"
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return res.json({
      employees: employees.map((employee) => ({
        id: employee.id,
        fullName: employee.fullName,
        email: employee.email,
        phone: employee.phone,
        employeeRole: employee.employeeRole,
        createdAt: employee.createdAt
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/employees", async (req, res, next) => {
  try {
    const { fullName, email, password, phone, employeeRole } = req.body;
    const normalizedEmployeeRole = String(employeeRole || "").trim().toLowerCase();

    if (!fullName || !email || !password) {
      return res.status(400).json({
        message: "fullName, email, password, and employeeRole are required."
      });
    }

    if (!ALLOWED_EMPLOYEE_ROLES.has(normalizedEmployeeRole)) {
      return res.status(400).json({
        message: "employeeRole must be one of: chef, cashier, waiter, inventory_manager."
      });
    }

    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const passwordHash = await hashPassword(password);

    const employee = await prisma.user.create({
      data: {
        fullName: String(fullName).trim(),
        email: normalizedEmail,
        phone: phone ? String(phone).trim() : null,
        passwordHash,
        systemRole: "EMPLOYEE",
        employeeRole: normalizedEmployeeRole,
        restaurantId: req.auth.restaurantId
      }
    });

    return res.status(201).json({
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        email: employee.email,
        phone: employee.phone,
        employeeRole: employee.employeeRole,
        createdAt: employee.createdAt
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/tables", async (req, res, next) => {
  try {
    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const tables = await prisma.diningTable.findMany({
      where: {
        restaurantId: req.auth.restaurantId
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    return res.json({
      tables: tables.map(mapTable)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/tables", async (req, res, next) => {
  try {
    const { name, seats, status } = req.body;
    const normalizedName = String(name || "").trim();
    const normalizedStatus = status ? String(status).trim().toUpperCase() : "AVAILABLE";

    if (!normalizedName) {
      return res.status(400).json({ message: "name is required." });
    }

    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const normalizedSeats = seats === undefined || seats === null || seats === "" ? 4 : Number(seats);
    if (!Number.isInteger(normalizedSeats)) {
      return res.status(400).json({ message: "seats must be a whole number." });
    }
    if (normalizedSeats < 1 || normalizedSeats > 20) {
      return res.status(400).json({ message: "seats must be between 1 and 20." });
    }
    if (!ALLOWED_TABLE_STATUSES.has(normalizedStatus)) {
      return res
        .status(400)
        .json({ message: "status must be one of: AVAILABLE, OCCUPIED, RESERVED, CLEANING." });
    }

    const table = await prisma.diningTable.create({
      data: {
        name: normalizedName,
        seats: normalizedSeats,
        status: normalizedStatus,
        restaurantId: req.auth.restaurantId
      }
    });

    return res.status(201).json({
      table: mapTable(table)
    });
  } catch (error) {
    if (error && error.code === "P2002") {
      return res.status(409).json({ message: "Table name already exists in this restaurant." });
    }
    return next(error);
  }
});

router.patch("/tables/:tableId", async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const { name, seats, status } = req.body;

    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const existingTable = await prisma.diningTable.findFirst({
      where: {
        id: tableId,
        restaurantId: req.auth.restaurantId
      }
    });

    if (!existingTable) {
      return res.status(404).json({ message: "Table not found." });
    }

    const data = {};
    if (name !== undefined) {
      const normalizedName = String(name).trim();
      if (!normalizedName) {
        return res.status(400).json({ message: "name cannot be empty." });
      }
      data.name = normalizedName;
    }

    if (seats !== undefined) {
      const normalizedSeats = Number(seats);
      if (!Number.isInteger(normalizedSeats)) {
        return res.status(400).json({ message: "seats must be a whole number." });
      }
      if (normalizedSeats < 1 || normalizedSeats > 20) {
        return res.status(400).json({ message: "seats must be between 1 and 20." });
      }
      data.seats = normalizedSeats;
    }

    if (status !== undefined) {
      const normalizedStatus = String(status).trim().toUpperCase();
      if (!ALLOWED_TABLE_STATUSES.has(normalizedStatus)) {
        return res
          .status(400)
          .json({ message: "status must be one of: AVAILABLE, OCCUPIED, RESERVED, CLEANING." });
      }
      data.status = normalizedStatus;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No valid fields provided." });
    }

    const updatedTable = await prisma.diningTable.update({
      where: { id: tableId },
      data
    });

    return res.json({ table: mapTable(updatedTable) });
  } catch (error) {
    if (error && error.code === "P2002") {
      return res.status(409).json({ message: "Table name already exists in this restaurant." });
    }
    return next(error);
  }
});

router.get("/menu", async (req, res, next) => {
  try {
    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const items = await listMenuItems(prisma, req.auth.restaurantId, {
      includeHidden: true,
      includeUnavailable: true
    });

    return res.json({ items });
  } catch (error) {
    return next(error);
  }
});

router.post("/menu", async (req, res, next) => {
  return res.status(403).json({
    message: "Kitchen staff must create dishes from the kitchen workspace."
  });
});

router.patch("/menu/:itemId", async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { name, category, description, photoUrl, price, isAvailable, stock } = req.body;

    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const existingItem = await prisma.menuItem.findFirst({
      where: {
        id: itemId,
        restaurantId: req.auth.restaurantId
      }
    });

    if (!existingItem) {
      return res.status(404).json({ message: "Menu item not found." });
    }

    const data = {};
    if (name !== undefined) {
      const normalizedName = String(name).trim();
      if (!normalizedName) {
        return res.status(400).json({ message: "name cannot be empty." });
      }
      data.name = normalizedName;
    }

    if (category !== undefined) {
      const normalizedCategory = String(category).trim();
      if (!normalizedCategory) {
        return res.status(400).json({ message: "category cannot be empty." });
      }
      data.category = normalizedCategory;
    }

    if (description !== undefined) {
      const normalizedDescription = String(description || "").trim();
      data.description = normalizedDescription || null;
    }

    if (photoUrl !== undefined) {
      const normalizedPhotoUrl = String(photoUrl || "").trim();
      data.photoUrl = normalizedPhotoUrl || null;
    }

    if (price !== undefined) {
      const priceCents = parsePriceToCents(price);
      if (priceCents === null) {
        return res.status(400).json({ message: "price must be greater than 0." });
      }
      data.priceCents = priceCents;
    }

    if (stock !== undefined) {
      const parsedStock = parseStock(stock);
      if (parsedStock.error) {
        return res.status(400).json({ message: parsedStock.error });
      }
      data.stock = parsedStock.value;
    }

    if (isAvailable !== undefined) {
      if (typeof isAvailable !== "boolean") {
        return res.status(400).json({ message: "isAvailable must be boolean." });
      }
      data.isAvailable = isAvailable;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No valid fields provided." });
    }

    const updatedItem = await prisma.menuItem.update({
      where: { id: itemId },
      data,
      include: MENU_ITEM_AVAILABILITY_INCLUDE
    });

    return res.json({ item: mapMenuItem(updatedItem) });
  } catch (error) {
    if (error && error.code === "P2002") {
      return res.status(409).json({ message: "Menu item name already exists in this restaurant." });
    }
    return next(error);
  }
});

router.get("/menu/:itemId/recipe", async (req, res, next) => {
  try {
    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const result = await getRecipeForMenuItem(
      prisma,
      req.auth.restaurantId,
      String(req.params.itemId || "").trim()
    );

    return res.json(result);
  } catch (error) {
    return handleInventoryError(res, error, next);
  }
});

router.put("/menu/:itemId/recipe", async (req, res, next) => {
  try {
    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const recipe = await upsertRecipeForMenuItem(
      prisma,
      req.auth.restaurantId,
      String(req.params.itemId || "").trim(),
      req.body
    );

    return res.json({
      message: "Recipe saved successfully.",
      recipe
    });
  } catch (error) {
    return handleInventoryError(res, error, next);
  }
});

router.patch("/menu/:itemId/recipe/approve", async (req, res, next) => {
  try {
    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const owner = await prisma.user.findUnique({
      where: {
        id: req.auth.userId
      },
      select: {
        fullName: true
      }
    });

    const recipe = await approveRecipeForMenuItem(
      prisma,
      req.auth.restaurantId,
      String(req.params.itemId || "").trim(),
      {
        approvedByName: owner?.fullName || "Owner",
        approvedAt: new Date()
      }
    );

    return res.json({
      message: "Recipe approved successfully.",
      recipe
    });
  } catch (error) {
    return handleInventoryError(res, error, next);
  }
});

router.delete("/menu/:itemId/recipe", async (req, res, next) => {
  try {
    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    await deleteRecipeForMenuItem(prisma, req.auth.restaurantId, String(req.params.itemId || "").trim());

    return res.json({
      message: "Recipe deleted successfully."
    });
  } catch (error) {
    return handleInventoryError(res, error, next);
  }
});

router.get("/inventory/ingredients", async (req, res, next) => {
  try {
    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const ingredients = await listIngredientsWithStock(prisma, req.auth.restaurantId);
    return res.json({ ingredients });
  } catch (error) {
    return handleInventoryError(res, error, next);
  }
});

router.post("/inventory/ingredients", async (req, res, next) => {
  try {
    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const parsedCurrentStock = parseCurrentStock(req.body?.currentStock);
    if (parsedCurrentStock.error) {
      return res.status(400).json({ message: parsedCurrentStock.error });
    }

    const ingredient = await runSerializableTransaction(prisma, async (tx) => {
      const createdIngredient = await createIngredient(tx, req.auth.restaurantId, req.body);

      if (parsedCurrentStock.hasValue && parsedCurrentStock.value > 0) {
        await createManualStockMovement(tx, req.auth.restaurantId, {
          ingredientId: createdIngredient.id,
          type: "PURCHASE",
          quantity: parsedCurrentStock.value,
          note: "Initial stock entered by owner"
        });
      }

      const ingredientRecord = await tx.ingredient.findFirst({
        where: {
          id: createdIngredient.id,
          restaurantId: req.auth.restaurantId
        },
        include: {
          stock: true
        }
      });

      return mapIngredient(ingredientRecord);
    });

    return res.status(201).json({
      message: "Ingredient created successfully.",
      ingredient
    });
  } catch (error) {
    return handleInventoryError(res, error, next);
  }
});

router.patch("/inventory/ingredients/:ingredientId", async (req, res, next) => {
  try {
    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const hasCurrentStockField = Object.prototype.hasOwnProperty.call(req.body || {}, "currentStock");
    const parsedCurrentStock = parseCurrentStock(req.body?.currentStock);
    if (parsedCurrentStock.error) {
      return res.status(400).json({ message: parsedCurrentStock.error });
    }

    const ingredientId = String(req.params.ingredientId || "").trim();
    const hasIngredientFields = ["name", "unit", "minStock"].some((field) =>
      Object.prototype.hasOwnProperty.call(req.body || {}, field)
    );

    if (!hasCurrentStockField && !hasIngredientFields) {
      return res.status(400).json({ message: "No valid fields provided." });
    }

    const ingredient = await runSerializableTransaction(prisma, async (tx) => {
      const existingIngredient = await tx.ingredient.findFirst({
        where: {
          id: ingredientId,
          restaurantId: req.auth.restaurantId
        },
        include: {
          stock: true
        }
      });

      if (!existingIngredient) {
        throw new InventoryError("Ingredient not found.", 404);
      }

      if (hasIngredientFields) {
        await updateIngredient(tx, req.auth.restaurantId, ingredientId, req.body);
      }

      if (hasCurrentStockField) {
        const currentStock = Number(existingIngredient.stock?.currentStock || 0);
        const stockDelta = Math.round((parsedCurrentStock.value - currentStock) * 1000) / 1000;

        if (Math.abs(stockDelta) > 0.000001) {
          await createManualStockMovement(tx, req.auth.restaurantId, {
            ingredientId,
            type: "ADJUSTMENT",
            quantity: stockDelta,
            note: "Stock updated by owner"
          });
        }
      }

      const ingredientRecord = await tx.ingredient.findFirst({
        where: {
          id: ingredientId,
          restaurantId: req.auth.restaurantId
        },
        include: {
          stock: true
        }
      });

      return mapIngredient(ingredientRecord);
    });

    return res.json({
      message: "Ingredient updated successfully.",
      ingredient
    });
  } catch (error) {
    return handleInventoryError(res, error, next);
  }
});

module.exports = router;
