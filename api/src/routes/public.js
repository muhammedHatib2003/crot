const express = require("express");
const prisma = require("../db");

const router = express.Router();
const ACTIVE_ORDER_STATUSES = ["PENDING", "PREPARING", "READY"];

function formatOrderCode(orderCode) {
  return `#${String(orderCode || "").slice(-6).toUpperCase()}`;
}

function mapMenuItem(item) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.description,
    photoUrl: item.photoUrl,
    priceCents: item.priceCents,
    price: item.priceCents / 100
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
          name: order.table.name
        }
      : null,
    items: (order.items || []).map(mapOrderItem)
  };
}

async function getTableContext(tableId) {
  const table = await prisma.diningTable.findUnique({
    where: { id: tableId },
    include: {
      restaurant: {
        include: {
          subscription: true
        }
      }
    }
  });

  if (!table) {
    return { error: { status: 404, message: "Table not found." } };
  }

  if (!table.restaurant.subscription || table.restaurant.subscription.status !== "ACTIVE") {
    return { error: { status: 403, message: "Ordering is not available for this restaurant yet." } };
  }

  return { table };
}

router.get("/tables/:tableId/menu", async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const { table, error } = await getTableContext(tableId);

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const items = await prisma.menuItem.findMany({
      where: {
        restaurantId: table.restaurantId,
        isAvailable: true
      },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    });

    return res.json({
      restaurant: {
        id: table.restaurant.id,
        name: table.restaurant.name
      },
      table: {
        id: table.id,
        name: table.name,
        seats: table.seats,
        status: table.status
      },
      items: items.map(mapMenuItem)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/tables/:tableId/orders", async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const { customerName, notes, items } = req.body;
    const { table, error } = await getTableContext(tableId);

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items must contain at least one product." });
    }

    const itemIds = [...new Set(items.map((item) => String(item?.menuItemId || "").trim()).filter(Boolean))];
    if (itemIds.length === 0) {
      return res.status(400).json({ message: "Each order item must include menuItemId." });
    }

    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: itemIds },
        restaurantId: table.restaurantId,
        isAvailable: true
      }
    });

    const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));
    const orderItems = [];
    let totalCents = 0;

    for (const item of items) {
      const menuItemId = String(item?.menuItemId || "").trim();
      const quantity = Number(item?.quantity);
      const itemNotes = String(item?.notes || "").trim();

      if (!menuItemId) {
        return res.status(400).json({ message: "Each order item must include menuItemId." });
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        return res.status(400).json({ message: "quantity must be a whole number between 1 and 20." });
      }

      const menuItem = menuItemMap.get(menuItemId);
      if (!menuItem) {
        return res.status(400).json({ message: "One or more selected menu items are unavailable." });
      }

      orderItems.push({
        menuItemId: menuItem.id,
        nameSnapshot: menuItem.name,
        priceCents: menuItem.priceCents,
        quantity,
        notes: itemNotes || null
      });
      totalCents += menuItem.priceCents * quantity;
    }

    const createdOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          restaurantId: table.restaurantId,
          tableId: table.id,
          customerName: String(customerName || "").trim() || null,
          notes: String(notes || "").trim() || null,
          totalCents,
          items: {
            create: orderItems
          }
        },
        include: {
          table: true,
          items: true
        }
      });

      await tx.diningTable.update({
        where: { id: table.id },
        data: {
          status: "OCCUPIED"
        }
      });

      return order;
    });

    return res.status(201).json({
      message: "Order placed successfully.",
      order: mapOrder(createdOrder)
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/orders/:orderId", async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        restaurant: {
          include: {
            subscription: true
          }
        },
        items: true,
        payment: true
      }
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (!order.restaurant.subscription || order.restaurant.subscription.status !== "ACTIVE") {
      return res.status(403).json({ message: "Ordering is not available for this restaurant yet." });
    }

    const hasOpenOrders = await prisma.order.count({
      where: {
        tableId: order.tableId,
        status: {
          in: ACTIVE_ORDER_STATUSES
        }
      }
    });

    return res.json({
      order: mapOrder(order),
      restaurant: {
        id: order.restaurant.id,
        name: order.restaurant.name
      },
      table: {
        id: order.table.id,
        name: order.table.name,
        status: order.table.status
      },
      hasOpenOrders: hasOpenOrders > 0
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
