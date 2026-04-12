const prisma = require("../db");
const { mapOrderRecord, orderDetailsInclude, toDbOrderStatus } = require("../models/order.model");
const { mapKitchenOrderRecord } = require("../models/kitchenOrder.model");
const { createKitchenOrder, KitchenServiceError } = require("../services/kitchen.service");
const { deductStockForOrder, runInSerializableTransaction, StockServiceError } = require("../services/stock.service");

class OrderControllerError extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.name = "OrderControllerError";
    this.status = status;
    this.details = details;
  }
}

function sendSuccess(res, statusCode, data, message, warning = "") {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    warning
  });
}

function sendFailure(res, error) {
  return res.status(error.status || 500).json({
    success: false,
    data: {},
    message: error.message || "Internal server error.",
    warning: ""
  });
}

function resolveRestaurantId(req) {
  const restaurantId =
    req.auth?.restaurantId ||
    req.body?.restaurantId ||
    req.params?.restaurantId ||
    req.query?.restaurantId;

  if (!restaurantId) {
    throw new OrderControllerError("restaurantId is required in the authenticated context or request body.", 400);
  }

  return String(restaurantId).trim();
}

function normalizeOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderControllerError("items must contain at least one product.");
  }

  return items.map((item) => {
    const productId = String(item?.productId || "").trim();
    const quantity = Number(item?.quantity);
    const notes = String(item?.notes || "").trim();

    if (!productId) {
      throw new OrderControllerError("Each order item must include productId.");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new OrderControllerError("Each order item quantity must be a positive integer.");
    }

    return {
      productId,
      quantity,
      notes: notes || null
    };
  });
}

function normalizeTableNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value).trim();
}

function normalizePatchStatus(body) {
  const status = toDbOrderStatus(body?.status);
  if (!status) {
    throw new OrderControllerError("status must be one of pending, sent_to_kitchen, preparing, ready, paid.");
  }

  return status;
}

function buildOrderStatusUpdate(status, currentOrder) {
  const now = new Date();
  const data = {
    status
  };

  if (status === "PREPARING" && !currentOrder.preparingAt) {
    data.preparingAt = now;
  }

  if (status === "READY" && !currentOrder.readyAt) {
    data.readyAt = now;
  }

  if (status === "PAID") {
    data.paymentStatus = "PAID";
  }

  return data;
}

async function buildOrderDraft(client, restaurantId, items) {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await client.menuItem.findMany({
    where: {
      restaurantId,
      id: {
        in: productIds
      },
      isAvailable: true
    }
  });

  const productMap = new Map(products.map((product) => [product.id, product]));
  const orderItems = [];
  let totalCents = 0;

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new OrderControllerError("One or more products are unavailable.", 409);
    }

    orderItems.push({
      restaurantId,
      menuItemId: product.id,
      nameSnapshot: product.name,
      priceCents: product.priceCents,
      quantity: item.quantity,
      notes: item.notes
    });
    totalCents += product.priceCents * item.quantity;
  }

  return {
    totalCents,
    orderItems
  };
}

async function createOrder(req, res, next) {
  try {
    const restaurantId = resolveRestaurantId(req);
    const tableNumber = normalizeTableNumber(req.body?.tableNumber);
    const items = normalizeOrderItems(req.body?.items);

    const result = await runInSerializableTransaction(prisma, async (tx) => {
      const orderDraft = await buildOrderDraft(tx, restaurantId, items);

      const createdOrder = await tx.order.create({
        data: {
          restaurantId,
          tableNumber,
          status: "PENDING",
          totalCents: orderDraft.totalCents,
          items: {
            create: orderDraft.orderItems
          }
        },
        include: {
          items: true
        }
      });

      const kitchenOrder = await createKitchenOrder(tx, {
        restaurantId,
        orderId: createdOrder.id,
        items: createdOrder.items
      });

      const stockResult = await deductStockForOrder(tx, {
        restaurantId,
        orderId: createdOrder.id,
        orderCode: createdOrder.orderCode,
        items: createdOrder.items.map((item) => ({
          productId: item.menuItemId,
          quantity: item.quantity,
          name: item.nameSnapshot
        }))
      });

      const order = await tx.order.update({
        where: {
          id: createdOrder.id
        },
        data: {
          status: "SENT_TO_KITCHEN"
        },
        include: orderDetailsInclude
      });

      return {
        order,
        kitchenOrder,
        stockMovements: stockResult.movements,
        warning: stockResult.warning
      };
    });

    return sendSuccess(
      res,
      201,
      {
        order: mapOrderRecord(result.order),
        kitchenOrder: mapKitchenOrderRecord(result.kitchenOrder),
        stockMovements: result.stockMovements
      },
      "Order created successfully.",
      result.warning
    );
  } catch (error) {
    if (error instanceof OrderControllerError || error instanceof StockServiceError || error instanceof KitchenServiceError) {
      return sendFailure(res, error);
    }

    return next(error);
  }
}

async function listOrders(req, res, next) {
  try {
    const restaurantId = resolveRestaurantId(req);
    const orders = await prisma.order.findMany({
      where: {
        restaurantId
      },
      include: orderDetailsInclude,
      orderBy: [{ createdAt: "desc" }]
    });

    return sendSuccess(
      res,
      200,
      {
        orders: orders.map((order) => ({
          ...mapOrderRecord(order),
          kitchenOrder: mapKitchenOrderRecord(order.kitchenOrder)
        }))
      },
      "Orders fetched successfully."
    );
  } catch (error) {
    if (error instanceof OrderControllerError) {
      return sendFailure(res, error);
    }

    return next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const restaurantId = resolveRestaurantId(req);
    const orderId = String(req.params?.id || "").trim();
    const nextStatus = normalizePatchStatus(req.body);

    if (!orderId) {
      throw new OrderControllerError("order id is required.");
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        restaurantId
      },
      include: orderDetailsInclude
    });

    if (!order) {
      throw new OrderControllerError("Order not found.", 404);
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: order.id
      },
      data: buildOrderStatusUpdate(nextStatus, order),
      include: orderDetailsInclude
    });

    return sendSuccess(
      res,
      200,
      {
        order: mapOrderRecord(updatedOrder),
        kitchenOrder: mapKitchenOrderRecord(updatedOrder.kitchenOrder)
      },
      "Order status updated successfully."
    );
  } catch (error) {
    if (error instanceof OrderControllerError) {
      return sendFailure(res, error);
    }

    return next(error);
  }
}

async function payOrder(req, res, next) {
  try {
    const restaurantId = resolveRestaurantId(req);
    const orderId = String(req.params?.id || "").trim();

    if (!orderId) {
      throw new OrderControllerError("order id is required.");
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        restaurantId
      },
      include: orderDetailsInclude
    });

    if (!order) {
      throw new OrderControllerError("Order not found.", 404);
    }

    const paidOrder = await prisma.order.update({
      where: {
        id: order.id
      },
      data: {
        status: "PAID",
        paymentStatus: "PAID"
      },
      include: orderDetailsInclude
    });

    return sendSuccess(
      res,
      200,
      {
        order: mapOrderRecord(paidOrder),
        kitchenOrder: mapKitchenOrderRecord(paidOrder.kitchenOrder)
      },
      "Order marked as paid."
    );
  } catch (error) {
    if (error instanceof OrderControllerError) {
      return sendFailure(res, error);
    }

    return next(error);
  }
}

module.exports = {
  OrderControllerError,
  createOrder,
  listOrders,
  payOrder,
  updateOrderStatus
};
