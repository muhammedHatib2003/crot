const express = require("express");
const prisma = require("../db");
const { hashPassword } = require("../utils/password");
const { authenticate, requireRoles } = require("../middleware/auth");

const router = express.Router();
const ALLOWED_EMPLOYEE_ROLES = new Set(["chef", "cashier"]);
const ALLOWED_TABLE_STATUSES = new Set(["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"]);

function mapRestaurant(restaurant) {
  return {
    id: restaurant.id,
    name: restaurant.name,
    phone: restaurant.phone,
    logoUrl: restaurant.logoUrl
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

function mapMenuItem(item) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.description,
    photoUrl: item.photoUrl,
    priceCents: item.priceCents,
    price: item.priceCents / 100,
    isAvailable: item.isAvailable,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function parsePriceToCents(rawPrice) {
  const parsed = Number(rawPrice);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed * 100);
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

function hasActiveSubscription(subscription) {
  return Boolean(subscription && subscription.status === "ACTIVE");
}

async function requireActiveSubscription(req, res, next) {
  try {
    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { restaurantId: req.auth.restaurantId },
      include: {
        plan: true
      }
    });

    if (!hasActiveSubscription(subscription)) {
      return res.status(403).json({
        message: "Please select a plan before using owner tools.",
        requiresPlanSelection: true
      });
    }

    req.activeSubscription = subscription;
    return next();
  } catch (error) {
    return next(error);
  }
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

    if (!Object.prototype.hasOwnProperty.call(req.body || {}, "logoUrl")) {
      return res.status(400).json({ message: "logoUrl is required." });
    }

    const { logoUrl } = req.body || {};
    const { value: normalizedLogoUrl, error } = normalizeOptionalHttpUrl(logoUrl);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const restaurant = await prisma.restaurant.update({
      where: { id: req.auth.restaurantId },
      data: {
        logoUrl: normalizedLogoUrl
      }
    });

    return res.json({
      message: normalizedLogoUrl ? "Logo updated successfully." : "Logo removed successfully.",
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
        message: "employeeRole must be one of: chef, cashier."
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

    const items = await prisma.menuItem.findMany({
      where: { restaurantId: req.auth.restaurantId },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    });

    return res.json({ items: items.map(mapMenuItem) });
  } catch (error) {
    return next(error);
  }
});

router.post("/menu", async (req, res, next) => {
  try {
    const { name, category, description, photoUrl, price } = req.body;
    const normalizedName = String(name || "").trim();
    const normalizedCategory = String(category || "General").trim() || "General";
    const normalizedDescription = String(description || "").trim();
    const normalizedPhotoUrl = String(photoUrl || "").trim();
    const priceCents = parsePriceToCents(price);

    if (!normalizedName) {
      return res.status(400).json({ message: "name is required." });
    }
    if (priceCents === null) {
      return res.status(400).json({ message: "price must be greater than 0." });
    }

    if (!req.auth.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const item = await prisma.menuItem.create({
      data: {
        name: normalizedName,
        category: normalizedCategory,
        description: normalizedDescription || null,
        photoUrl: normalizedPhotoUrl || null,
        priceCents,
        restaurantId: req.auth.restaurantId
      }
    });

    return res.status(201).json({ item: mapMenuItem(item) });
  } catch (error) {
    if (error && error.code === "P2002") {
      return res.status(409).json({ message: "Menu item name already exists in this restaurant." });
    }
    return next(error);
  }
});

router.patch("/menu/:itemId", async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { name, category, description, photoUrl, price, isAvailable } = req.body;

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
      data
    });

    return res.json({ item: mapMenuItem(updatedItem) });
  } catch (error) {
    if (error && error.code === "P2002") {
      return res.status(409).json({ message: "Menu item name already exists in this restaurant." });
    }
    return next(error);
  }
});

module.exports = router;
