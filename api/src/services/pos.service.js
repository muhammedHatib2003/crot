const { Prisma } = require("@prisma/client");
const prisma = require("../db");
const { MENU_ITEM_AVAILABILITY_INCLUDE, getMenuItemAvailability, mapMenuItem } = require("../utils/menu");
const {
  ACTIVE_ORDER_STATUSES,
  TABLE_DB_ORDER_TYPES,
  buildOrderStatusUpdateData,
  getAllowedNextStatuses,
  mapOrder
} = require("../utils/orders");
const { mapTable, syncTableStatus } = require("../utils/tables");

const orderInclude = {
  items: true,
  table: true,
  payment: true
};

class PosServiceError extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.name = "PosServiceError";
    this.status = status;
    this.details = details;
  }
}

function normalizeOptionalText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeLineItems(rawItems, options = {}) {
  const allowEmpty = Boolean(options.allowEmpty);
  const items = Array.isArray(rawItems) ? rawItems : [];

  if (!allowEmpty && items.length === 0) {
    throw new PosServiceError("items must contain at least one product.", 400);
  }

  return items.map((item) => {
    const productId = String(item?.productId || item?.menuItemId || "").trim();
    const quantity = Number(item?.quantity);
    const notes = normalizeOptionalText(item?.notes);

    if (!productId) {
      throw new PosServiceError("Each order item must include productId.", 400);
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new PosServiceError("quantity must be a whole number between 1 and 20.", 400);
    }

    return {
      productId,
      quantity,
      notes
    };
  });
}

function sumQuantities(items, key) {
  const quantities = new Map();

  for (const item of items) {
    const itemKey = String(item?.[key] || "").trim();
    if (!itemKey) {
      continue;
    }

    quantities.set(itemKey, (quantities.get(itemKey) || 0) + Number(item.quantity || 0));
  }

  return quantities;
}

function buildOrderItemsData(items, productsById, restaurantId) {
  return items.map((item) => {
    const product = productsById.get(item.productId);

    return {
      restaurantId,
      menuItemId: product.id,
      nameSnapshot: product.name,
      priceCents: product.priceCents,
      quantity: item.quantity,
      notes: item.notes
    };
  });
}

function calculateTotalCents(orderItemsData) {
  return orderItemsData.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}

async function runSerializableTransaction(callback) {
  return prisma.$transaction((tx) => callback(tx), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
}

async function getTableOrThrow(client, restaurantId, tableId) {
  const table = await client.diningTable.findFirst({
    where: {
      id: tableId,
      restaurantId
    }
  });

  if (!table) {
    throw new PosServiceError("Table not found.", 404);
  }

  return table;
}

async function getOrderOrThrow(client, restaurantId, orderId) {
  const order = await client.order.findFirst({
    where: {
      id: orderId,
      restaurantId
    },
    include: orderInclude
  });

  if (!order) {
    throw new PosServiceError("Order not found.", 404);
  }

  return order;
}

async function loadProductsForItems(client, restaurantId, productIds) {
  const uniqueProductIds = [...new Set(productIds.filter(Boolean))];
  const products = await client.menuItem.findMany({
    where: {
      restaurantId,
      id: {
        in: uniqueProductIds
      }
    },
    include: MENU_ITEM_AVAILABILITY_INCLUDE
  });

  if (products.length !== uniqueProductIds.length) {
    throw new PosServiceError("One or more selected products are unavailable.", 404);
  }

  return new Map(products.map((product) => [product.id, product]));
}

async function reserveStockForOrder(client, restaurantId, previousItems, nextItems) {
  const previousQuantities = sumQuantities(previousItems, "menuItemId");
  const nextQuantities = sumQuantities(nextItems, "productId");
  const productIds = [...new Set([...previousQuantities.keys(), ...nextQuantities.keys()])];
  const productsById = await loadProductsForItems(client, restaurantId, productIds);

  const productUpdates = [];

  for (const productId of productIds) {
    const product = productsById.get(productId);
    const previousQuantity = previousQuantities.get(productId) || 0;
    const nextQuantity = nextQuantities.get(productId) || 0;
    const manualAvailableQuantity = product.stock + previousQuantity;
    const availability = getMenuItemAvailability(product, { previousQuantity });
    const availableQuantity = availability.availableStock;

    if (nextQuantity > 0 && !product.isAvailable && previousQuantity === 0) {
      throw new PosServiceError(`${product.name} is currently unavailable.`, 409);
    }

    if (nextQuantity > 0 && !availability.isOrderable && previousQuantity === 0) {
      const unavailableMessage =
        availability.availabilityReason === "INSUFFICIENT_INGREDIENTS"
          ? `${product.name} cannot be ordered right now because ingredients are not enough.`
          : availability.availabilityReason === "RECIPE_INCOMPLETE"
            ? `${product.name} recipe is not ready yet.`
            : `${product.name} is currently unavailable.`;
      throw new PosServiceError(unavailableMessage, 409, {
        productId,
        productName: product.name,
        availabilityReason: availability.availabilityReason
      });
    }

    if (nextQuantity > availableQuantity) {
      throw new PosServiceError(`Only ${availableQuantity} left for ${product.name}.`, 409, {
        productId,
        productName: product.name,
        availableStock: availableQuantity,
        availabilityReason: availability.availabilityReason
      });
    }

    const nextStock = manualAvailableQuantity - nextQuantity;
    if (nextStock !== product.stock) {
      productUpdates.push(
        client.menuItem.update({
          where: {
            id: product.id
          },
          data: {
            stock: nextStock
          }
        })
      );
    }
  }

  if (productUpdates.length > 0) {
    await Promise.all(productUpdates);
  }

  return productsById;
}

async function savePendingOrder(client, order, payload) {
  if (order.status !== "PENDING") {
    throw new PosServiceError("Only pending orders can be edited.", 409);
  }

  const items = normalizeLineItems(payload.items);
  const productsById = await reserveStockForOrder(client, order.restaurantId, order.items, items);
  const orderItemsData = buildOrderItemsData(items, productsById, order.restaurantId);
  const totalCents = calculateTotalCents(orderItemsData);

  const updatedOrder = await client.order.update({
    where: {
      id: order.id
    },
    data: {
      source: String(payload.source || order.source || "WAITER").trim().toUpperCase(),
      customerName: normalizeOptionalText(payload.customerName) ?? order.customerName,
      customerPhone: normalizeOptionalText(payload.customerPhone) ?? order.customerPhone,
      notes: normalizeOptionalText(payload.notes) ?? order.notes,
      totalCents,
      items: {
        deleteMany: {},
        create: orderItemsData
      }
    },
    include: orderInclude
  });

  await syncTableStatus(client, updatedOrder.tableId);
  return mapOrder(updatedOrder);
}

async function createOrderRecord(client, payload) {
  const items = normalizeLineItems(payload.items);
  const productsById = await reserveStockForOrder(client, payload.restaurantId, [], items);
  const orderItemsData = buildOrderItemsData(items, productsById, payload.restaurantId);
  const totalCents = calculateTotalCents(orderItemsData);

  const createdOrder = await client.order.create({
    data: {
      restaurantId: payload.restaurantId,
      tableId: payload.tableId || null,
      tableNumber: payload.tableName || null,
      orderType: payload.orderType || "DINE_IN",
      source: String(payload.source || "WAITER").trim().toUpperCase(),
      status: "PENDING",
      customerName: normalizeOptionalText(payload.customerName),
      customerPhone: normalizeOptionalText(payload.customerPhone),
      notes: normalizeOptionalText(payload.notes),
      totalCents,
      items: {
        create: orderItemsData
      }
    },
    include: orderInclude
  });

  await syncTableStatus(client, createdOrder.tableId);
  return mapOrder(createdOrder);
}

async function findPendingTableOrder(client, restaurantId, tableId) {
  return client.order.findFirst({
    where: {
      restaurantId,
      tableId,
      orderType: {
        in: TABLE_DB_ORDER_TYPES
      },
      status: "PENDING"
    },
    include: orderInclude,
    orderBy: [{ createdAt: "desc" }]
  });
}

async function createOrAppendTableOrder(payload) {
  return runSerializableTransaction(async (tx) => {
    const table = await getTableOrThrow(tx, payload.restaurantId, payload.tableId);
    const existingPendingOrder = await findPendingTableOrder(tx, payload.restaurantId, table.id);

    if (existingPendingOrder) {
      const nextItems = [
        ...existingPendingOrder.items.map((item) => ({
          productId: item.menuItemId,
          quantity: item.quantity,
          notes: item.notes || null
        })),
        ...normalizeLineItems(payload.items)
      ];

      return savePendingOrder(tx, existingPendingOrder, {
        ...payload,
        items: nextItems,
        source:
          String(payload.source || "").trim().toUpperCase() === "QR"
            ? "QR"
            : existingPendingOrder.source || "WAITER"
      });
    }

    return createOrderRecord(tx, {
      ...payload,
      tableId: table.id,
      tableName: table.name,
      orderType: "DINE_IN"
    });
  });
}

async function replacePendingOrder(payload) {
  return runSerializableTransaction(async (tx) => {
    const order = await getOrderOrThrow(tx, payload.restaurantId, payload.orderId);
    return savePendingOrder(tx, order, payload);
  });
}

async function deletePendingOrder(payload) {
  return runSerializableTransaction(async (tx) => {
    const order = await getOrderOrThrow(tx, payload.restaurantId, payload.orderId);

    if (order.status !== "PENDING") {
      throw new PosServiceError("Only pending orders can be deleted.", 409);
    }

    await reserveStockForOrder(tx, payload.restaurantId, order.items, []);
    await tx.order.delete({
      where: {
        id: order.id
      }
    });
    await syncTableStatus(tx, order.tableId);

    return {
      id: order.id
    };
  });
}

async function createPickupOrder(payload) {
  return runSerializableTransaction(async (tx) =>
    createOrderRecord(tx, {
      ...payload,
      orderType: "PICKUP",
      tableId: null,
      tableName: null
    })
  );
}

async function updateOrderStatus(payload) {
  return runSerializableTransaction(async (tx) => {
    const order = await getOrderOrThrow(tx, payload.restaurantId, payload.orderId);
    const nextStatus = String(payload.status || "").trim().toUpperCase();
    const allowedStatuses = getAllowedNextStatuses(payload.actorRole, order.status);

    if (!allowedStatuses.includes(nextStatus)) {
      throw new PosServiceError("You are not allowed to set this order status.", 403);
    }

    const updatedOrder = await tx.order.update({
      where: {
        id: order.id
      },
      data: buildOrderStatusUpdateData(nextStatus, order),
      include: orderInclude
    });

    await syncTableStatus(tx, updatedOrder.tableId);
    return mapOrder(updatedOrder);
  });
}

async function markOrderSeenByWaiter(payload) {
  return runSerializableTransaction(async (tx) => {
    const order = await getOrderOrThrow(tx, payload.restaurantId, payload.orderId);

    if (order.status !== "READY") {
      throw new PosServiceError("Only ready orders can be marked as seen by waiter.", 409);
    }

    if (order.waiterSeenAt) {
      return mapOrder(order);
    }

    const updatedOrder = await tx.order.update({
      where: {
        id: order.id
      },
      data: {
        waiterSeenAt: new Date()
      },
      include: orderInclude
    });

    return mapOrder(updatedOrder);
  });
}

async function listRoleOrders(restaurantId, statuses) {
  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      status: {
        in: statuses
      }
    },
    include: orderInclude,
    orderBy: [{ createdAt: "asc" }]
  });

  return orders.map(mapOrder);
}

async function listWaiterTables(restaurantId) {
  const tables = await prisma.diningTable.findMany({
    where: {
      restaurantId
    },
    include: {
      orders: {
        where: {
          status: {
            in: ACTIVE_ORDER_STATUSES
          },
          orderType: {
            in: TABLE_DB_ORDER_TYPES
          }
        },
        include: orderInclude,
        orderBy: [{ createdAt: "asc" }]
      }
    },
    orderBy: [{ name: "asc" }]
  });

  return tables.map((table) => {
    const activeOrders = table.orders.map(mapOrder);
    const pendingOrder = activeOrders.find((order) => order.status === "PENDING") || null;

    return {
      ...mapTable(table),
      isOccupied: activeOrders.length > 0,
      pendingOrder,
      activeOrders,
      activeOrderCount: activeOrders.length
    };
  });
}

async function listProducts(restaurantId, options = {}) {
  const availableOnly = Boolean(options.availableOnly);
  const products = await prisma.menuItem.findMany({
    where: {
      restaurantId
    },
    include: MENU_ITEM_AVAILABILITY_INCLUDE,
    orderBy: [{ category: "asc" }, { name: "asc" }]
  });

  const mappedProducts = products.map((product) => mapMenuItem(product));
  return availableOnly ? mappedProducts.filter((product) => product.isOrderable) : mappedProducts;
}

async function setProductStock(restaurantId, productId, stock) {
  const normalizedStock = Number(stock);

  if (!Number.isInteger(normalizedStock) || normalizedStock < 0) {
    throw new PosServiceError("stock must be a whole number greater than or equal to 0.", 400);
  }

  const product = await prisma.menuItem.findFirst({
    where: {
      id: productId,
      restaurantId
    }
  });

  if (!product) {
    throw new PosServiceError("Product not found.", 404);
  }

  const updatedProduct = await prisma.menuItem.update({
    where: {
      id: product.id
    },
    data: {
      stock: normalizedStock
    },
    include: MENU_ITEM_AVAILABILITY_INCLUDE
  });

  return mapMenuItem(updatedProduct);
}

module.exports = {
  PosServiceError,
  createOrAppendTableOrder,
  createPickupOrder,
  deletePendingOrder,
  listProducts,
  listRoleOrders,
  listWaiterTables,
  markOrderSeenByWaiter,
  normalizeLineItems,
  orderInclude,
  replacePendingOrder,
  runSerializableTransaction,
  setProductStock,
  updateOrderStatus
};
