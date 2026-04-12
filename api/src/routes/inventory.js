const express = require("express");
const prisma = require("../db");
const { authenticate, requireRoles } = require("../middleware/auth");
const { getEmployeeContext, normalizeEmployeeRole } = require("../utils/employees");
const {
  InventoryError,
  createIngredient,
  createManualStockMovement,
  getInventoryDashboard,
  listIngredientsWithStock,
  listIngredientRequests,
  mapIngredient,
  runSerializableTransaction,
  updateIngredientRequestStatus,
  updateIngredient
} = require("../services/inventory");
const { listMenuItems } = require("../utils/menu");
const { PosServiceError, listProducts, setProductStock } = require("../services/pos.service");

const router = express.Router();

router.use(authenticate, requireRoles("EMPLOYEE"));

async function requireInventoryManager(req, res) {
  const employee = await getEmployeeContext(prisma, req.auth.userId);

  if (!employee) {
    return { error: { status: 404, message: "Employee not found." } };
  }

  if (!employee.restaurantId) {
    return { error: { status: 400, message: "Employee has no restaurant assigned." } };
  }

  if (normalizeEmployeeRole(employee.employeeRole) !== "inventory_manager") {
    return { error: { status: 403, message: "Only inventory manager can access inventory operations." } };
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

function buildMenuSummary(menuItems) {
  return {
    totalItems: menuItems.length,
    withRecipeCount: menuItems.filter((item) => item.hasRecipe).length,
    missingRecipeCount: menuItems.filter((item) => !item.hasRecipe).length,
    orderableCount: menuItems.filter((item) => item.isOrderable).length,
    blockedCount: menuItems.filter((item) => !item.isOrderable).length,
    ingredientLimitedCount: menuItems.filter((item) => item.recipeLimited).length
  };
}

router.get("/dashboard", async (req, res, next) => {
  try {
    const { employee, error } = await requireInventoryManager(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const [dashboard, menuItems] = await Promise.all([
      getInventoryDashboard(prisma, employee.restaurantId),
      listMenuItems(prisma, employee.restaurantId, {
        includeHidden: true,
        includeUnavailable: true
      })
    ]);

    return res.json({
      ...dashboard,
      menuItems,
      menuSummary: buildMenuSummary(menuItems)
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.get("/ingredients", async (req, res, next) => {
  try {
    const { employee, error } = await requireInventoryManager(req, res);
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
    const { employee, error } = await requireInventoryManager(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const requests = await listIngredientRequests(prisma, employee.restaurantId);
    return res.json({ requests });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.post("/ingredients", async (req, res, next) => {
  try {
    const { employee, error } = await requireInventoryManager(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const parsedCurrentStock = parseCurrentStock(req.body?.currentStock);
    if (parsedCurrentStock.error) {
      return res.status(400).json({ message: parsedCurrentStock.error });
    }

    const ingredient = await runSerializableTransaction(prisma, async (tx) => {
      const createdIngredient = await createIngredient(tx, employee.restaurantId, req.body);

      if (parsedCurrentStock.hasValue && parsedCurrentStock.value > 0) {
        await createManualStockMovement(tx, employee.restaurantId, {
          ingredientId: createdIngredient.id,
          type: "PURCHASE",
          quantity: parsedCurrentStock.value,
          note: "Initial stock entered by inventory manager"
        });
      }

      const ingredientRecord = await tx.ingredient.findFirst({
        where: {
          id: createdIngredient.id,
          restaurantId: employee.restaurantId
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
    return handleServiceError(res, error, next);
  }
});

router.patch("/requests/:requestId/status", async (req, res, next) => {
  try {
    const { employee, error } = await requireInventoryManager(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const request = await updateIngredientRequestStatus(
      prisma,
      employee.restaurantId,
      String(req.params.requestId || "").trim(),
      {
        status: req.body?.status,
        handledByName: employee.fullName || "Inventory"
      }
    );

    return res.json({
      message: "Request updated successfully.",
      request
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.patch("/ingredients/:ingredientId", async (req, res, next) => {
  try {
    const { employee, error } = await requireInventoryManager(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
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
          restaurantId: employee.restaurantId
        },
        include: {
          stock: true
        }
      });

      if (!existingIngredient) {
        throw new InventoryError("Ingredient not found.", 404);
      }

      if (hasIngredientFields) {
        await updateIngredient(tx, employee.restaurantId, ingredientId, req.body);
      }

      if (hasCurrentStockField) {
        const currentStock = Number(existingIngredient.stock?.currentStock || 0);
        const stockDelta = Math.round((parsedCurrentStock.value - currentStock) * 1000) / 1000;

        if (Math.abs(stockDelta) > 0.000001) {
          await createManualStockMovement(tx, employee.restaurantId, {
            ingredientId,
            type: "ADJUSTMENT",
            quantity: stockDelta,
            note: "Stock updated by inventory manager"
          });
        }
      }

      const ingredientRecord = await tx.ingredient.findFirst({
        where: {
          id: ingredientId,
          restaurantId: employee.restaurantId
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
    return handleServiceError(res, error, next);
  }
});

router.get("/products", async (req, res, next) => {
  try {
    const { employee, error } = await requireInventoryManager(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const products = await listProducts(employee.restaurantId);
    return res.json({ products });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.patch("/products/:productId/stock", async (req, res, next) => {
  try {
    const { employee, error } = await requireInventoryManager(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const product = await setProductStock(
      employee.restaurantId,
      String(req.params.productId || "").trim(),
      req.body?.stock
    );

    return res.json({
      message: "Stock updated successfully.",
      product
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

module.exports = router;
