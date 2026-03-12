const express = require("express");
const prisma = require("../db");
const { authenticate, requireRoles } = require("../middleware/auth");

const router = express.Router();
const ALLOWED_TABLE_STATUSES = new Set(["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"]);
const ALLOWED_PAYMENT_METHODS = new Set(["CASH", "CARD"]);
const ACTIVE_ORDER_STATUSES = ["PENDING", "PREPARING", "READY"];
const ROLE_ORDER_STATUS_ACCESS = {
  chef: ["PENDING", "PREPARING", "READY"],
  cashier: ["READY"]
};
const ROLE_ORDER_TRANSITIONS = {
  chef: {
    PENDING: ["PREPARING"],
    PREPARING: ["READY"]
  },
  cashier: {
    READY: ["PAID"]
  }
};

router.use(authenticate, requireRoles("EMPLOYEE"));

function normalizeEmployeeRole(employeeRole) {
  return String(employeeRole || "").trim().toLowerCase();
}

function formatOrderCode(orderCode) {
  return `#${String(orderCode || "").slice(-6).toUpperCase()}`;
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

function mapOrderItem(item) {
  return {
    id: item.id,
    menuItemId: item.menuItemId,
    name: item.nameSnapshot,
    priceCents: item.priceCents,
    price: item.priceCents / 100,
    quantity: item.quantity,
    notes: item.notes
  };
}

function mapOrder(order) {
  return {
    id: order.id,
    orderCode: formatOrderCode(order.orderCode),
    status: order.status,
    customerName: order.customerName,
    notes: order.notes,
    totalCents: order.totalCents,
    total: order.totalCents / 100,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    payment: order.payment
      ? {
          id: order.payment.id,
          receiptCode: formatOrderCode(order.payment.receiptCode),
          paymentMethod: order.payment.paymentMethod,
          totalCents: order.payment.totalCents,
          total: order.payment.totalCents / 100,
          createdAt: order.payment.createdAt
        }
      : null,
    table: order.table
      ? {
          id: order.table.id,
          name: order.table.name,
          status: order.table.status
        }
      : null,
    items: (order.items || []).map(mapOrderItem)
  };
}

function mapPayment(payment) {
  return {
    id: payment.id,
    receiptCode: formatOrderCode(payment.receiptCode),
    paymentMethod: payment.paymentMethod,
    totalCents: payment.totalCents,
    total: payment.totalCents / 100,
    createdAt: payment.createdAt,
    table: payment.table
      ? {
          id: payment.table.id,
          name: payment.table.name
        }
      : null,
    orders: (payment.orders || []).map((order) => ({
      id: order.id,
      orderCode: formatOrderCode(order.orderCode),
      totalCents: order.totalCents,
      total: order.totalCents / 100
    }))
  };
}

async function getEmployeeContext(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      employeeRole: true,
      restaurantId: true
    }
  });
}

function getAllowedNextStatuses(employeeRole, currentStatus) {
  return ROLE_ORDER_TRANSITIONS[employeeRole]?.[currentStatus] || [];
}

async function syncTableStatus(transaction, tableId) {
  const activeOrdersCount = await transaction.order.count({
    where: {
      tableId,
      status: {
        in: ACTIVE_ORDER_STATUSES
      }
    }
  });

  await transaction.diningTable.update({
    where: { id: tableId },
    data: {
      status: activeOrdersCount > 0 ? "OCCUPIED" : "AVAILABLE"
    }
  });
}

router.get("/orders", async (req, res, next) => {
  try {
    const employee = await getEmployeeContext(req.auth.userId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }
    if (!employee.restaurantId) {
      return res.status(400).json({ message: "Employee has no restaurant assigned." });
    }

    const employeeRole = normalizeEmployeeRole(employee.employeeRole);
    const statuses = ROLE_ORDER_STATUS_ACCESS[employeeRole] || [];

    const orders = await prisma.order.findMany({
      where: {
        restaurantId: employee.restaurantId,
        status: {
          in: statuses
        }
      },
      include: {
        table: true,
        items: true,
        payment: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return res.json({
      orders: orders.map(mapOrder)
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/orders/:orderId/status", async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const employee = await getEmployeeContext(req.auth.userId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }
    if (!employee.restaurantId) {
      return res.status(400).json({ message: "Employee has no restaurant assigned." });
    }

    const employeeRole = normalizeEmployeeRole(employee.employeeRole);
    const normalizedStatus = String(status || "").trim().toUpperCase();

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        restaurantId: employee.restaurantId
      },
      include: {
        table: true,
        items: true,
        payment: true
      }
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const allowedStatuses = getAllowedNextStatuses(employeeRole, order.status);
    if (!allowedStatuses.includes(normalizedStatus)) {
      return res.status(403).json({ message: "You are not allowed to set this order status." });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const nextOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: normalizedStatus
        },
        include: {
          table: true,
          items: true,
          payment: true
        }
      });

      await syncTableStatus(tx, nextOrder.tableId);
      return nextOrder;
    });

    return res.json({
      order: mapOrder(updatedOrder)
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/tables", async (req, res, next) => {
  try {
    const employee = await getEmployeeContext(req.auth.userId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }
    if (!employee.restaurantId) {
      return res.status(400).json({ message: "Employee has no restaurant assigned." });
    }

    const employeeRole = normalizeEmployeeRole(employee.employeeRole);
    if (employeeRole !== "cashier") {
      return res.status(403).json({ message: "Only cashier can access restaurant tables." });
    }

    const tables = await prisma.diningTable.findMany({
      where: {
        restaurantId: employee.restaurantId
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    return res.json({ tables: tables.map(mapTable) });
  } catch (error) {
    return next(error);
  }
});

router.get("/payments", async (req, res, next) => {
  try {
    const employee = await getEmployeeContext(req.auth.userId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }
    if (!employee.restaurantId) {
      return res.status(400).json({ message: "Employee has no restaurant assigned." });
    }

    const employeeRole = normalizeEmployeeRole(employee.employeeRole);
    if (employeeRole !== "cashier") {
      return res.status(403).json({ message: "Only cashier can access payment history." });
    }

    const payments = await prisma.payment.findMany({
      where: {
        restaurantId: employee.restaurantId
      },
      include: {
        table: true,
        orders: true
      },
      orderBy: [{ createdAt: "desc" }],
      take: 20
    });

    return res.json({
      payments: payments.map(mapPayment)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/tables/:tableId/checkout", async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const { paymentMethod } = req.body;

    const employee = await getEmployeeContext(req.auth.userId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }
    if (!employee.restaurantId) {
      return res.status(400).json({ message: "Employee has no restaurant assigned." });
    }

    const employeeRole = normalizeEmployeeRole(employee.employeeRole);
    if (employeeRole !== "cashier") {
      return res.status(403).json({ message: "Only cashier can complete checkout." });
    }

    const normalizedPaymentMethod = String(paymentMethod || "").trim().toUpperCase();
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
        status: "READY"
      },
      include: {
        table: true,
        items: true
      },
      orderBy: [{ createdAt: "asc" }]
    });

    if (readyOrders.length === 0) {
      return res.status(400).json({ message: "There is no ready order waiting for payment on this table." });
    }

    const orderIds = readyOrders.map((order) => order.id);
    const totalCents = readyOrders.reduce((sum, order) => sum + order.totalCents, 0);

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
          status: "PAID",
          paymentId: payment.id
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
    return next(error);
  }
});

router.patch("/tables/:tableId/status", async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const { status } = req.body;

    const employee = await getEmployeeContext(req.auth.userId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }
    if (!employee.restaurantId) {
      return res.status(400).json({ message: "Employee has no restaurant assigned." });
    }

    const employeeRole = normalizeEmployeeRole(employee.employeeRole);
    if (employeeRole !== "cashier") {
      return res.status(403).json({ message: "Only cashier can update table status." });
    }

    const normalizedStatus = String(status || "").trim().toUpperCase();
    if (!ALLOWED_TABLE_STATUSES.has(normalizedStatus)) {
      return res
        .status(400)
        .json({ message: "status must be one of: AVAILABLE, OCCUPIED, RESERVED, CLEANING." });
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

    const updatedTable = await prisma.diningTable.update({
      where: { id: tableId },
      data: { status: normalizedStatus }
    });

    return res.json({ table: mapTable(updatedTable) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
