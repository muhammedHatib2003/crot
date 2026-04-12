const express = require("express");
const prisma = require("../db");
const { authenticate, requireRoles } = require("../middleware/auth");
const { getEmployeeContext, normalizeEmployeeRole } = require("../utils/employees");
const {
  PosServiceError,
  createOrAppendTableOrder,
  deletePendingOrder,
  listProducts,
  listWaiterTables,
  markOrderSeenByWaiter,
  replacePendingOrder,
  updateOrderStatus
} = require("../services/pos.service");

const router = express.Router();

router.use(authenticate, requireRoles("EMPLOYEE"));

async function requireWaiter(req, res) {
  const employee = await getEmployeeContext(prisma, req.auth.userId);

  if (!employee) {
    return { error: { status: 404, message: "Employee not found." } };
  }

  if (!employee.restaurantId) {
    return { error: { status: 400, message: "Employee has no restaurant assigned." } };
  }

  if (normalizeEmployeeRole(employee.employeeRole) !== "waiter") {
    return { error: { status: 403, message: "Only waiter can access waiter operations." } };
  }

  return { employee };
}

function handleServiceError(res, error, next) {
  if (error instanceof PosServiceError) {
    return res.status(error.status).json({
      message: error.message,
      details: error.details || undefined
    });
  }

  return next(error);
}

router.get("/tables", async (req, res, next) => {
  try {
    const { employee, error } = await requireWaiter(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const tables = await listWaiterTables(employee.restaurantId);
    return res.json({ tables });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.get("/products", async (req, res, next) => {
  try {
    const { employee, error } = await requireWaiter(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const products = await listProducts(employee.restaurantId, { availableOnly: true });
    return res.json({ products });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.post("/orders", async (req, res, next) => {
  try {
    const { employee, error } = await requireWaiter(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const tableId = String(req.body?.tableId || "").trim();
    if (!tableId) {
      return res.status(400).json({ message: "tableId is required." });
    }

    const order = await createOrAppendTableOrder({
      restaurantId: employee.restaurantId,
      tableId,
      items: req.body?.items,
      source: "WAITER"
    });

    return res.status(201).json({
      message: "Order saved successfully.",
      order
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.put("/orders/:orderId", async (req, res, next) => {
  try {
    const { employee, error } = await requireWaiter(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const order = await replacePendingOrder({
      restaurantId: employee.restaurantId,
      orderId: String(req.params.orderId || "").trim(),
      items: req.body?.items,
      source: req.body?.source
    });

    return res.json({
      message: "Order updated successfully.",
      order
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.delete("/orders/:orderId", async (req, res, next) => {
  try {
    const { employee, error } = await requireWaiter(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    await deletePendingOrder({
      restaurantId: employee.restaurantId,
      orderId: String(req.params.orderId || "").trim()
    });

    return res.json({
      message: "Pending order deleted."
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.patch("/orders/:orderId/status", async (req, res, next) => {
  try {
    const { employee, error } = await requireWaiter(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const order = await updateOrderStatus({
      restaurantId: employee.restaurantId,
      orderId: String(req.params.orderId || "").trim(),
      status: req.body?.status,
      actorRole: "waiter"
    });

    return res.json({
      order
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.patch("/orders/:orderId/seen", async (req, res, next) => {
  try {
    const { employee, error } = await requireWaiter(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const order = await markOrderSeenByWaiter({
      restaurantId: employee.restaurantId,
      orderId: String(req.params.orderId || "").trim()
    });

    return res.json({
      order
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

module.exports = router;
