const ACTIVE_ORDER_STATUSES = ["PENDING", "ACCEPTED", "PREPARING", "READY"];
const KITCHEN_ORDER_STATUSES = ["PENDING", "ACCEPTED", "PREPARING", "READY"];
const READY_ORDER_STATUSES = ["READY"];
const TABLE_DB_ORDER_TYPES = ["DINE_IN"];

const ROLE_ALIASES = {
  chef: "kitchen",
  kitchen: "kitchen",
  cashier: "cashier",
  waiter: "waiter",
  owner: "owner",
  courier: "courier"
};

const ROLE_ORDER_STATUS_ACCESS = {
  kitchen: KITCHEN_ORDER_STATUSES,
  cashier: READY_ORDER_STATUSES,
  waiter: ACTIVE_ORDER_STATUSES,
  owner: ACTIVE_ORDER_STATUSES,
  courier: ["READY", "SERVED"]
};

const ROLE_ORDER_TRANSITIONS = {
  kitchen: {
    PENDING: ["ACCEPTED", "PREPARING"],
    ACCEPTED: ["PREPARING"],
    PREPARING: ["READY"],
    READY: ["COMPLETED"]
  },
  cashier: {
    READY: ["PAID", "COMPLETED"]
  },
  waiter: {
    READY: ["PAID", "COMPLETED"]
  },
  courier: {
    READY: ["SERVED"],
    SERVED: ["COMPLETED"]
  },
  owner: {
    PENDING: ["ACCEPTED", "PREPARING", "PAID", "COMPLETED", "CANCELLED"],
    ACCEPTED: ["PREPARING", "PAID", "COMPLETED", "CANCELLED"],
    PREPARING: ["READY", "PAID", "COMPLETED", "CANCELLED"],
    READY: ["PAID", "COMPLETED", "CANCELLED"]
  }
};

function formatOrderCode(orderCode) {
  const rawValue = String(orderCode || "").trim();
  if (!rawValue) {
    return "";
  }

  return `#${rawValue.slice(-6).toUpperCase()}`;
}

function normalizeActorRole(actorRole) {
  return ROLE_ALIASES[String(actorRole || "").trim().toLowerCase()] || "";
}

function toApiOrderType(dbOrderType) {
  const normalized = String(dbOrderType || "").trim().toUpperCase();
  if (TABLE_DB_ORDER_TYPES.includes(normalized)) {
    return "TABLE";
  }

  return normalized || "TABLE";
}

function normalizeOrderType(orderType) {
  const normalized = String(orderType || "").trim().toUpperCase();

  if (normalized === "TABLE" || normalized === "DINE_IN") {
    return "DINE_IN";
  }

  if (normalized === "PICKUP") {
    return "PICKUP";
  }

  if (normalized === "DELIVERY") {
    return "DELIVERY";
  }

  return null;
}

function isActiveOrderStatus(status) {
  return ACTIVE_ORDER_STATUSES.includes(String(status || "").trim().toUpperCase());
}

function mapOrderItem(item) {
  return {
    id: item.id,
    productId: item.menuItemId,
    menuItemId: item.menuItemId,
    name: item.nameSnapshot,
    productName: item.nameSnapshot,
    priceCents: item.priceCents,
    price: item.priceCents / 100,
    quantity: item.quantity,
    notes: item.notes || null
  };
}

function mapPayment(payment) {
  if (!payment) {
    return null;
  }

  return {
    id: payment.id,
    receiptCode: formatOrderCode(payment.receiptCode),
    paymentMethod: payment.paymentMethod,
    totalCents: payment.totalCents,
    total: payment.totalCents / 100,
    totalPrice: payment.totalCents / 100,
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
      status: order.status,
      orderType: toApiOrderType(order.orderType),
      total: order.totalCents / 100,
      totalPrice: order.totalCents / 100
    }))
  };
}

function mapOrder(order) {
  if (!order) {
    return null;
  }

  return {
    id: order.id,
    publicId: order.publicId,
    orderCode: formatOrderCode(order.orderCode),
    orderType: toApiOrderType(order.orderType),
    source: String(order.source || "WAITER").trim().toUpperCase(),
    status: order.status,
    paymentStatus: order.paymentStatus,
    customerName: order.customerName || null,
    customerPhone: order.customerPhone || null,
    customerUserId: order.customerUserId || null,
    customerAddress: order.customerAddress || order.deliveryAddressText || null,
    deliveryAddressText: order.deliveryAddressText || order.customerAddress || null,
    deliveryLatitude: order.deliveryLatitude ?? null,
    deliveryLongitude: order.deliveryLongitude ?? null,
    distanceKm: order.distanceKm ?? null,
    assignedCourierAccountId: order.assignedCourierAccountId || null,
    courierAcceptedAt: order.courierAcceptedAt || null,
    notes: order.notes || null,
    subtotalCents: Number(order.subtotalCents || order.totalCents || 0),
    subtotal: Number(order.subtotalCents || order.totalCents || 0) / 100,
    deliveryFeeCents: Number(order.deliveryFeeCents || 0),
    deliveryFee: Number(order.deliveryFeeCents || 0) / 100,
    totalCents: order.totalCents,
    total: order.totalCents / 100,
    totalPrice: order.totalCents / 100,
    preparingAt: order.preparingAt || null,
    readyAt: order.readyAt || null,
    kitchenCompletedAt: order.kitchenCompletedAt || null,
    waiterSeenAt: order.waiterSeenAt || null,
    completedAt: order.completedAt || null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    tableId: order.tableId || null,
    restaurantId: order.restaurantId || null,
    restaurant: order.restaurant
      ? {
          id: order.restaurant.id,
          name: order.restaurant.name,
          slug: order.restaurant.slug || null,
          logoUrl: order.restaurant.logoUrl || null,
          latitude: order.restaurant.latitude ?? null,
          longitude: order.restaurant.longitude ?? null,
          address: order.restaurant.address || order.restaurant.addressText || null,
          city: order.restaurant.city || null,
          district: order.restaurant.district || null
        }
      : null,
    table: order.table
      ? {
          id: order.table.id,
          name: order.table.name,
          status: order.table.status
        }
      : null,
    items: (order.items || []).map(mapOrderItem),
    payment: mapPayment(order.payment)
  };
}

function getAllowedNextStatuses(actorRole, currentStatus) {
  const normalizedRole = normalizeActorRole(actorRole);
  const normalizedStatus = String(currentStatus || "").trim().toUpperCase();
  return ROLE_ORDER_TRANSITIONS[normalizedRole]?.[normalizedStatus] || [];
}

function getVisibleStatusesForRole(actorRole) {
  const normalizedRole = normalizeActorRole(actorRole);
  return ROLE_ORDER_STATUS_ACCESS[normalizedRole] || [];
}

function buildOrderStatusUpdateData(nextStatus, currentOrder) {
  const normalizedStatus = String(nextStatus || "").trim().toUpperCase();
  const now = new Date();
  const data = {
    status: normalizedStatus
  };

  if (normalizedStatus === "ACCEPTED" && !currentOrder.acceptedAt) {
    data.acceptedAt = now;
  }

  if (normalizedStatus === "PREPARING" && !currentOrder.preparingAt) {
    data.preparingAt = now;
  }

  if (normalizedStatus === "READY" && !currentOrder.readyAt) {
    data.readyAt = now;
  }

  if (normalizedStatus === "PAID") {
    data.paymentStatus = "PAID";
    if (!currentOrder.completedAt) {
      data.completedAt = now;
    }
  }

  if (normalizedStatus === "COMPLETED" && !currentOrder.completedAt) {
    data.completedAt = now;
  }

  return data;
}

module.exports = {
  ACTIVE_ORDER_STATUSES,
  KITCHEN_ORDER_STATUSES,
  READY_ORDER_STATUSES,
  TABLE_DB_ORDER_TYPES,
  ROLE_ORDER_STATUS_ACCESS,
  buildOrderStatusUpdateData,
  formatOrderCode,
  getAllowedNextStatuses,
  getVisibleStatusesForRole,
  isActiveOrderStatus,
  mapOrder,
  mapOrderItem,
  mapPayment,
  normalizeOrderType,
  normalizeActorRole,
  toApiOrderType
};
