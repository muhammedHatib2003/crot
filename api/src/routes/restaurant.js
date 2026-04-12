const express = require("express");
const prisma = require("../db");
const { authenticate, requireRoles } = require("../middleware/auth");
const {
  ACTIVE_ORDER_STATUSES,
  mapOrder,
  getAllowedNextStatuses,
  normalizeOrderType,
  buildOrderStatusUpdateData
} = require("../utils/orders");

const router = express.Router();
const ALLOWED_ORDER_STATUSES = new Set(["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"]);

router.use(authenticate, requireRoles("OWNER", "EMPLOYEE"));

function normalizeEmployeeRole(employeeRole) {
  return String(employeeRole || "").trim().toLowerCase();
}

async function getActorContext(req) {
  if (!req.auth?.restaurantId) {
    return null;
  }

  if (req.auth.systemRole === "OWNER") {
    return {
      actorRole: "owner",
      restaurantId: req.auth.restaurantId
    };
  }

  const employee = await prisma.user.findUnique({
    where: {
      id: req.auth.userId
    },
    select: {
      restaurantId: true,
      employeeRole: true
    }
  });

  if (!employee || !employee.restaurantId) {
    return null;
  }

  return {
    actorRole: normalizeEmployeeRole(employee.employeeRole),
    restaurantId: employee.restaurantId
  };
}

function canCompleteOrder(order) {
  return order.orderType !== "DINE_IN" || order.paymentStatus === "PAID";
}

async function syncTableStatus(transaction, tableId) {
  if (!tableId) {
    return;
  }

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
    const actor = await getActorContext(req);
    if (!actor) {
      return res.status(400).json({ message: "Restaurant user has no restaurant assigned." });
    }

    const where = {
      restaurantId: actor.restaurantId
    };

    if (req.query.active === "true") {
      where.status = {
        in: ["PENDING", "ACCEPTED", "PREPARING", "READY"]
      };
    } else if (req.query.status) {
      const normalizedStatus = String(req.query.status).trim().toUpperCase();
      if (!ALLOWED_ORDER_STATUSES.has(normalizedStatus)) {
        return res.status(400).json({ message: "Invalid status filter." });
      }
      where.status = normalizedStatus;
    }

    if (req.query.orderType) {
      const normalizedType = normalizeOrderType(req.query.orderType);
      if (!normalizedType) {
        return res.status(400).json({ message: "Invalid orderType filter." });
      }
      where.orderType = normalizedType;
    }

    const orders = await prisma.order.findMany({
      where,
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
    const { status } = req.body || {};

    const actor = await getActorContext(req);
    if (!actor) {
      return res.status(400).json({ message: "Restaurant user has no restaurant assigned." });
    }

    const normalizedStatus = String(status || "").trim().toUpperCase();

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        restaurantId: actor.restaurantId
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

    const allowedStatuses = getAllowedNextStatuses(actor.actorRole, order.status);
    if (!allowedStatuses.includes(normalizedStatus)) {
      return res.status(403).json({ message: "You are not allowed to set this order status." });
    }

    if (normalizedStatus === "COMPLETED" && !canCompleteOrder(order)) {
      return res.status(403).json({ message: "Dine-in orders must be checked out before completion." });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const nextOrder = await tx.order.update({
        where: {
          id: order.id
        },
        data: buildOrderStatusUpdateData(normalizedStatus, order),
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

module.exports = router;
