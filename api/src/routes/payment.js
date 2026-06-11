const express = require("express");
const prisma = require("../db");
const { authenticate, requireRoles } = require("../middleware/auth");
const { getEmployeeContext, normalizeEmployeeRole } = require("../utils/employees");
const { CASHIER_VISIBLE_STATUSES, mapOrder, mapPayment } = require("../utils/orders");
const {
  PosServiceError,
  createOrAppendTableOrder,
  deletePendingOrder,
  listProducts,
  listRoleOrders,
  listWaiterTables,
  orderInclude,
  replacePendingOrder,
  updateOrderStatus
} = require("../services/pos.service");
const { syncTableStatus } = require("../utils/tables");

const router = express.Router();
const ALLOWED_PAYMENT_METHODS = new Set(["CASH", "CARD"]);

router.use(authenticate, requireRoles("EMPLOYEE"));

async function requireCashier(req, res) {
  const employee = await getEmployeeContext(prisma, req.auth.userId);

  if (!employee) {
    return { error: { status: 404, message: "Employee not found." } };
  }

  if (!employee.restaurantId) {
    return { error: { status: 400, message: "Employee has no restaurant assigned." } };
  }

  if (normalizeEmployeeRole(employee.employeeRole) !== "cashier") {
    return { error: { status: 403, message: "Only cashier can access cashier operations." } };
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

router.get("/orders", async (req, res, next) => {
  try {
    const { employee, error } = await requireCashier(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const orders = await listRoleOrders(employee.restaurantId, CASHIER_VISIBLE_STATUSES);
    return res.json({ orders });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.get("/tables", async (req, res, next) => {
  try {
    const { employee, error } = await requireCashier(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const tables = await listWaiterTables(employee.restaurantId);

    return res.json({
      tables: tables.map((table) => {
        const readyOrders = (table.activeOrders || []).filter(
          (order) => order.status === "READY" && order.orderType === "TABLE"
        );
        const totalDueCents = readyOrders.reduce(
          (sum, order) => sum + Math.round(Number(order.totalPrice || 0) * 100),
          0
        );

        return {
          ...table,
          readyOrderCount: readyOrders.length,
          totalDueCents,
          totalDue: totalDueCents / 100
        };
      })
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.get("/products", async (req, res, next) => {
  try {
    const { employee, error } = await requireCashier(req, res);
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
    const { employee, error } = await requireCashier(req, res);
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
      source: "CASHIER"
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
    const { employee, error } = await requireCashier(req, res);
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
    const { employee, error } = await requireCashier(req, res);
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

router.post("/orders/:orderId/checkout", async (req, res, next) => {
  try {
    const { employee, error } = await requireCashier(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const orderId = String(req.params.orderId || "").trim();
    const normalizedPaymentMethod = String(req.body?.paymentMethod || "").trim().toUpperCase();

    if (!ALLOWED_PAYMENT_METHODS.has(normalizedPaymentMethod)) {
      return res.status(400).json({ message: "paymentMethod must be CASH or CARD." });
    }

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

    if (order.orderType !== "PICKUP" && order.orderType !== "DELIVERY") {
      return res.status(400).json({ message: "Only pickup or delivery orders can be paid from this action." });
    }

    if (order.status !== "READY") {
      return res.status(409).json({ message: "Only ready orders can be checked out." });
    }

    const completedAt = new Date();

    const checkoutResult = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          paymentMethod: normalizedPaymentMethod,
          totalCents: order.totalCents,
          restaurantId: employee.restaurantId
        }
      });

      const updatedOrder = await tx.order.update({
        where: {
          id: order.id
        },
        data: {
          status: "COMPLETED",
          paymentStatus: "PAID",
          paymentMethod: normalizedPaymentMethod,
          paymentId: payment.id,
          completedAt
        },
        include: orderInclude
      });

      return {
        payment,
        order: updatedOrder
      };
    });

    return res.json({
      message: "Pickup payment completed.",
      payment: mapPayment({
        ...checkoutResult.payment,
        orders: [checkoutResult.order]
      }),
      order: mapOrder(checkoutResult.order)
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.patch("/orders/:orderId/status", async (req, res, next) => {
  try {
    const { employee, error } = await requireCashier(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const order = await updateOrderStatus({
      restaurantId: employee.restaurantId,
      orderId: String(req.params.orderId || "").trim(),
      status: req.body?.status,
      actorRole: "cashier"
    });

    return res.json({ order });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.post("/tables/:tableId/checkout", async (req, res, next) => {
  try {
    const { employee, error } = await requireCashier(req, res);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const tableId = String(req.params.tableId || "").trim();
    const normalizedPaymentMethod = String(req.body?.paymentMethod || "").trim().toUpperCase();

    if (!ALLOWED_PAYMENT_METHODS.has(normalizedPaymentMethod)) {
      return res.status(400).json({ message: "paymentMethod must be CASH or CARD." });
    }

    const table = await prisma.diningTable.findFirst({
      where: {
        id: tableId,
        restaurantId: employee.restaurantId
      }
    });

    if (!table) {
      return res.status(404).json({ message: "Table not found." });
    }

    const readyOrders = await prisma.order.findMany({
      where: {
        restaurantId: employee.restaurantId,
        tableId,
        orderType: "DINE_IN",
        status: "READY"
      },
      include: {
        table: true,
        items: true
      },
      orderBy: [{ createdAt: "asc" }]
    });

    if (readyOrders.length === 0) {
      return res.status(400).json({ message: "There is no ready dine-in order waiting for payment on this table." });
    }

    const orderIds = readyOrders.map((order) => order.id);
    const totalCents = readyOrders.reduce((sum, order) => sum + order.totalCents, 0);
    const completedAt = new Date();

    const checkoutResult = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          paymentMethod: normalizedPaymentMethod,
          totalCents,
          restaurantId: employee.restaurantId,
          tableId
        }
      });

      await tx.order.updateMany({
        where: {
          id: {
            in: orderIds
          }
        },
        data: {
          status: "COMPLETED",
          paymentStatus: "PAID",
          paymentId: payment.id,
          completedAt
        }
      });

      await syncTableStatus(tx, tableId);

      const orders = await tx.order.findMany({
        where: {
          id: {
            in: orderIds
          }
        },
        include: {
          table: true,
          items: true,
          payment: true
        },
        orderBy: [{ createdAt: "asc" }]
      });

      return {
        payment,
        orders
      };
    });

    return res.json({
      message: "Payment completed and table is available again.",
      table: {
        id: table.id,
        name: table.name
      },
      payment: mapPayment({
        ...checkoutResult.payment,
        table,
        orders: checkoutResult.orders
      }),
      totalCents,
      total: totalCents / 100,
      orders: checkoutResult.orders.map(mapOrder)
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

module.exports = router;
