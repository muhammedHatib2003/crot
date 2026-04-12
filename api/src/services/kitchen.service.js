const { mapKitchenOrderRecord, toDbKitchenOrderStatus } = require("../models/kitchenOrder.model");
const { orderDetailsInclude } = require("../models/order.model");
const { runInSerializableTransaction } = require("./stock.service");

class KitchenServiceError extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.name = "KitchenServiceError";
    this.status = status;
    this.details = details;
  }
}

function buildKitchenItemSnapshot(items) {
  return (items || []).map((item) => ({
    productId: item.menuItemId || item.productId,
    name: item.nameSnapshot || item.name || null,
    quantity: item.quantity,
    notes: item.notes || null
  }));
}

async function createKitchenOrder(client, payload) {
  const restaurantId = String(payload?.restaurantId || "").trim();
  const orderId = String(payload?.orderId || "").trim();
  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (!restaurantId) {
    throw new KitchenServiceError("restaurantId is required.");
  }

  if (!orderId) {
    throw new KitchenServiceError("orderId is required.");
  }

  return client.kitchenOrder.create({
    data: {
      restaurantId,
      orderId,
      items: buildKitchenItemSnapshot(items),
      status: "WAITING"
    }
  });
}

async function listActiveKitchenOrders(client, restaurantId) {
  const orders = await client.kitchenOrder.findMany({
    where: {
      restaurantId,
      status: {
        in: ["WAITING", "PREPARING"]
      }
    },
    include: {
      order: {
        include: orderDetailsInclude
      }
    },
    orderBy: [{ createdAt: "asc" }]
  });

  return orders.map((order) => ({
    ...mapKitchenOrderRecord(order),
    order: order.order
  }));
}

async function updateKitchenOrderStatus(client, payload) {
  const restaurantId = String(payload?.restaurantId || "").trim();
  const kitchenOrderId = String(payload?.kitchenOrderId || "").trim();
  const nextStatus = toDbKitchenOrderStatus(payload?.status);

  if (!restaurantId) {
    throw new KitchenServiceError("restaurantId is required.");
  }

  if (!kitchenOrderId) {
    throw new KitchenServiceError("kitchenOrderId is required.");
  }

  if (!nextStatus) {
    throw new KitchenServiceError("status must be one of waiting, preparing, done.");
  }

  return runInSerializableTransaction(client, async (tx) => {
    const kitchenOrder = await tx.kitchenOrder.findFirst({
      where: {
        id: kitchenOrderId,
        restaurantId
      },
      include: {
        order: {
          include: orderDetailsInclude
        }
      }
    });

    if (!kitchenOrder) {
      throw new KitchenServiceError("Kitchen order not found.", 404);
    }

    const kitchenUpdateData = {
      status: nextStatus
    };

    if (nextStatus === "PREPARING" && !kitchenOrder.startedAt) {
      kitchenUpdateData.startedAt = new Date();
    }

    if (nextStatus === "DONE" && !kitchenOrder.completedAt) {
      kitchenUpdateData.completedAt = new Date();
    }

    const updatedKitchenOrder = await tx.kitchenOrder.update({
      where: {
        id: kitchenOrder.id
      },
      data: kitchenUpdateData,
      include: {
        order: {
          include: orderDetailsInclude
        }
      }
    });

    if (nextStatus === "PREPARING") {
      await tx.order.update({
        where: {
          id: kitchenOrder.orderId
        },
        data: {
          status: "PREPARING",
          preparingAt: kitchenOrder.order.preparingAt || new Date()
        }
      });
    }

    if (nextStatus === "DONE") {
      await tx.order.update({
        where: {
          id: kitchenOrder.orderId
        },
        data: {
          status: "READY",
          readyAt: kitchenOrder.order.readyAt || new Date()
        }
      });
    }

    return tx.kitchenOrder.findUnique({
      where: {
        id: updatedKitchenOrder.id
      },
      include: {
        order: {
          include: orderDetailsInclude
        }
      }
    });
  });
}

module.exports = {
  KitchenServiceError,
  createKitchenOrder,
  listActiveKitchenOrders,
  updateKitchenOrderStatus
};
