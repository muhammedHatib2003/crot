const { formatOrderCode } = require("./orders");

const PREPARING_STATUSES = ["PENDING", "ACCEPTED", "PREPARING"];
const READY_STATUSES = ["READY"];
const COMPLETED_STATUSES = ["COMPLETED", "PAID"];
const DISPLAY_ORDER_TYPES = ["PICKUP"];
const COMPLETED_DISPLAY_TTL_MS = 5 * 60 * 1000;

const DISPLAY_STATUS_LABELS = {
  PENDING: "Preparing",
  ACCEPTED: "Preparing",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  PAID: "Completed"
};

function getStartOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getDisplayUpdatedAt(order) {
  if (READY_STATUSES.includes(order.status)) {
    return order.readyAt || order.updatedAt || order.createdAt;
  }

  if (COMPLETED_STATUSES.includes(order.status)) {
    return order.completedAt || order.kitchenCompletedAt || order.readyAt || order.updatedAt || order.createdAt;
  }

  return order.preparingAt || order.updatedAt || order.createdAt;
}

function sanitizeCustomerName(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 80);
}

function getOrderHandoffAt(order) {
  if (COMPLETED_STATUSES.includes(order.status)) {
    return order.completedAt || order.kitchenCompletedAt || order.readyAt || order.updatedAt || null;
  }

  if (order.orderType === "PICKUP" && order.kitchenCompletedAt && READY_STATUSES.includes(order.status)) {
    return order.kitchenCompletedAt;
  }

  return null;
}

function isRecentlyCompleted(order, now = Date.now()) {
  const handoffAt = getOrderHandoffAt(order);
  if (!handoffAt) {
    return false;
  }

  return now - new Date(handoffAt).getTime() <= COMPLETED_DISPLAY_TTL_MS;
}

function mapDisplayOrder(order) {
  return {
    id: order.id,
    orderNumber: formatOrderCode(order.orderCode),
    customerName: sanitizeCustomerName(order.customerName),
    status: order.status,
    statusLabel: DISPLAY_STATUS_LABELS[order.status] || order.status,
    updatedAt: getDisplayUpdatedAt(order),
    createdAt: order.createdAt
  };
}

function groupDisplayOrders(orders) {
  const preparing = [];
  const ready = [];
  const completed = [];

  orders.forEach((order) => {
    const mapped = mapDisplayOrder(order);
    const isPickupHandedOff =
      order.orderType === "PICKUP" && order.kitchenCompletedAt && READY_STATUSES.includes(order.status);

    if (isPickupHandedOff || COMPLETED_STATUSES.includes(order.status)) {
      if (isRecentlyCompleted(order)) {
        completed.push(mapped);
      }
      return;
    }

    if (PREPARING_STATUSES.includes(order.status)) {
      preparing.push(mapped);
      return;
    }

    if (READY_STATUSES.includes(order.status)) {
      ready.push(mapped);
    }
  });

  const byUpdatedDesc = (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();

  preparing.sort(byUpdatedDesc);
  ready.sort(byUpdatedDesc);
  completed.sort(byUpdatedDesc);

  return {
    preparing,
    ready,
    completed: completed.slice(0, 30)
  };
}

async function fetchTodayDisplayOrders(client, restaurantId) {
  const startOfToday = getStartOfToday();
  const visibleStatuses = [...PREPARING_STATUSES, ...READY_STATUSES, ...COMPLETED_STATUSES];

  const orders = await client.order.findMany({
    where: {
      restaurantId,
      orderType: {
        in: DISPLAY_ORDER_TYPES
      },
      status: {
        in: visibleStatuses
      },
      createdAt: {
        gte: startOfToday
      }
    },
    select: {
      id: true,
      orderCode: true,
      orderType: true,
      customerName: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      preparingAt: true,
      readyAt: true,
      completedAt: true,
      kitchenCompletedAt: true
    },
    orderBy: [{ updatedAt: "desc" }]
  });

  return groupDisplayOrders(orders);
}

module.exports = {
  COMPLETED_DISPLAY_TTL_MS,
  COMPLETED_STATUSES,
  DISPLAY_ORDER_TYPES,
  PREPARING_STATUSES,
  READY_STATUSES,
  fetchTodayDisplayOrders,
  getOrderHandoffAt,
  groupDisplayOrders,
  isRecentlyCompleted,
  mapDisplayOrder
};
