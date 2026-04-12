const express = require("express");
const prisma = require("../db");
const { authenticate, requireRoles } = require("../middleware/auth");
const {
  InventoryError,
  consumeInventoryForOrder,
  createIngredientRequest,
  getInventoryDashboard,
  getRecipeForMenuItem,
  listIngredientsWithStock,
  listIngredientRequests,
  runSerializableTransaction,
  upsertRecipeForMenuItem
} = require("../services/inventory");
const { getEmployeeContext, normalizeEmployeeRole } = require("../utils/employees");
const { KITCHEN_ORDER_STATUSES, buildOrderStatusUpdateData, getAllowedNextStatuses, mapOrder } = require("../utils/orders");
const { listMenuItems, mapMenuItem, MENU_ITEM_AVAILABILITY_INCLUDE } = require("../utils/menu");
const { PosServiceError, listRoleOrders } = require("../services/pos.service");

const router = express.Router();

router.use(authenticate, requireRoles("EMPLOYEE"));

async function requireKitchen(req, res) {
  const employee = await getEmployeeContext(prisma, req.auth.userId);

  if (!employee) {
    return { error: { status: 404, message: "Employee not found." } };
  }

  if (!employee.restaurantId) {
    return { error: { status: 400, message: "Employee has no restaurant assigned." } };
  }

  const employeeRole = normalizeEmployeeRole(employee.employeeRole);
  if (employeeRole !== "chef" && employeeRole !== "kitchen") {
    return { error: { status: 403, message: "Only kitchen staff can access kitchen operations." } };
  }

  return { employee };
}

function handleServiceError(res, error, next) {
  if (error instanceof InventoryError) {
    return res.status(error.status).json({
      message: error.message,
      details: error.details || undefined
    });
  }

  if (error instanceof PosServiceError) {
    return res.status(error.status).json({
      message: error.message,
      details: error.details || undefined
    });
  }

  return next(error);
}

function parsePriceToCents(rawPrice) {
  const parsed = Number(rawPrice);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function parseStock(rawStock) {
  const parsed = Number(rawStock);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    return { error: "stock must be a whole number greater than or equal to 0." };
  }

  return { value: parsed };
}

const orderInclude = {
  table: true,
  items: true,
  payment: true
};

router.get("/orders", async (req, res, next) => {
  try {
    const { employee, error } = await requireKitchen(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const orders = (await listRoleOrders(employee.restaurantId, KITCHEN_ORDER_STATUSES)).filter(
      (order) => !order.kitchenCompletedAt
    );
    return res.json({ orders });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.post("/orders/:orderId/complete", async (req, res, next) => {
  try {
    const { employee, error } = await requireKitchen(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const orderId = String(req.params.orderId || "").trim();

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        restaurantId: employee.restaurantId
      },
      include: orderInclude
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.status !== "READY") {
      return res.status(409).json({ message: "Only ready orders can be completed on the kitchen display." });
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: order.id
      },
      data: {
        kitchenCompletedAt: new Date()
      },
      include: orderInclude
    });

    return res.json({
      order: mapOrder(updatedOrder)
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const { employee, error } = await requireKitchen(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const dashboard = await getInventoryDashboard(prisma, employee.restaurantId);
    return res.json(dashboard);
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.get("/menu", async (req, res, next) => {
  try {
    const { employee, error } = await requireKitchen(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const items = await listMenuItems(prisma, employee.restaurantId, {
      includeHidden: true,
      includeUnavailable: true
    });

    return res.json({ items });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.post("/menu", async (req, res, next) => {
  try {
    const { employee, error } = await requireKitchen(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const { name, category, description, photoUrl, price, stock } = req.body;
    const normalizedName = String(name || "").trim();
    const normalizedCategory = String(category || "General").trim() || "General";
    const normalizedDescription = String(description || "").trim();
    const normalizedPhotoUrl = String(photoUrl || "").trim();
    const priceCents = parsePriceToCents(price);
    const parsedStock = parseStock(stock);

    if (!normalizedName) {
      return res.status(400).json({ message: "name is required." });
    }
    if (priceCents === null) {
      return res.status(400).json({ message: "price must be greater than 0." });
    }
    if (parsedStock.error) {
      return res.status(400).json({ message: parsedStock.error });
    }

    const item = await prisma.menuItem.create({
      data: {
        name: normalizedName,
        category: normalizedCategory,
        description: normalizedDescription || null,
        photoUrl: normalizedPhotoUrl || null,
        priceCents,
        stock: parsedStock.value,
        restaurantId: employee.restaurantId
      },
      include: MENU_ITEM_AVAILABILITY_INCLUDE
    });

    return res.status(201).json({
      item: mapMenuItem(item)
    });
  } catch (error) {
    if (error && error.code === "P2002") {
      return res.status(409).json({ message: "Menu item name already exists in this restaurant." });
    }

    return handleServiceError(res, error, next);
  }
});

router.patch("/menu/:itemId", async (req, res, next) => {
  try {
    const { employee, error } = await requireKitchen(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const itemId = String(req.params.itemId || "").trim();
    const { name, category, description, photoUrl, price, stock, isAvailable } = req.body || {};

    const existingItem = await prisma.menuItem.findFirst({
      where: {
        id: itemId,
        restaurantId: employee.restaurantId
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

    const item = await prisma.menuItem.update({
      where: {
        id: existingItem.id
      },
      data,
      include: MENU_ITEM_AVAILABILITY_INCLUDE
    });

    return res.json({
      item: mapMenuItem(item)
    });
  } catch (error) {
    if (error && error.code === "P2002") {
      return res.status(409).json({ message: "Menu item name already exists in this restaurant." });
    }

    return handleServiceError(res, error, next);
  }
});

router.get("/ingredients", async (req, res, next) => {
  try {
    const { employee, error } = await requireKitchen(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const ingredients = await listIngredientsWithStock(prisma, employee.restaurantId);
    return res.json({ ingredients });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.get("/requests", async (req, res, next) => {
  try {
    const { employee, error } = await requireKitchen(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const requests = await listIngredientRequests(prisma, employee.restaurantId);
    return res.json({ requests });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.post("/requests", async (req, res, next) => {
  try {
    const { employee, error } = await requireKitchen(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const request = await createIngredientRequest(prisma, employee.restaurantId, {
      ingredientId: req.body?.ingredientId,
      requestedIngredientName: req.body?.requestedIngredientName,
      requestedUnit: req.body?.requestedUnit,
      quantity: req.body?.quantity,
      note: req.body?.note,
      requestedByName: employee.fullName || "Kitchen"
    });

    return res.status(201).json({
      message: "Ingredient request created successfully.",
      request
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.get("/menu/:itemId/recipe", async (req, res, next) => {
  try {
    const { employee, error } = await requireKitchen(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const result = await getRecipeForMenuItem(prisma, employee.restaurantId, String(req.params.itemId || "").trim());
    return res.json(result);
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.put("/menu/:itemId/recipe", async (req, res, next) => {
  try {
    const { employee, error } = await requireKitchen(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const recipe = await upsertRecipeForMenuItem(
      prisma,
      employee.restaurantId,
      String(req.params.itemId || "").trim(),
      req.body,
      {
        approvalStatus: "APPROVED",
        submittedByName: employee.fullName || "Kitchen",
        lastSubmittedAt: new Date(),
        approvedByName: null,
        approvedAt: null
      }
    );

    return res.json({
      message: "Recipe saved successfully.",
      recipe
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.patch("/orders/:orderId/status", async (req, res, next) => {
  try {
    const { employee, error } = await requireKitchen(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const orderId = String(req.params.orderId || "").trim();
    const nextStatus = String(req.body?.status || "").trim().toUpperCase();

    const order = await runSerializableTransaction(prisma, async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: {
          id: orderId,
          restaurantId: employee.restaurantId
        },
        include: orderInclude
      });

      if (!existingOrder) {
        throw new InventoryError("Order not found.", 404);
      }

      const allowedStatuses = getAllowedNextStatuses(employee.employeeRole, existingOrder.status);
      if (!allowedStatuses.includes(nextStatus)) {
        throw new InventoryError("You are not allowed to set this order status.", 403);
      }

      const updateData = buildOrderStatusUpdateData(nextStatus, existingOrder);
      if (nextStatus === "PREPARING") {
        const consumptionResult = await consumeInventoryForOrder(tx, existingOrder);
        if (consumptionResult.inventoryConsumedAt) {
          updateData.inventoryConsumedAt = consumptionResult.inventoryConsumedAt;
        }
      }

      const updatedOrder = await tx.order.update({
        where: {
          id: existingOrder.id
        },
        data: updateData,
        include: orderInclude
      });

      return mapOrder(updatedOrder);
    });

    return res.json({ order });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

module.exports = router;
