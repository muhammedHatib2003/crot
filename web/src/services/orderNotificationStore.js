const STORAGE_PREFIX = "crot_order_notifications";

function readStorage(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors.
  }
}

function getStorageKey(restaurantId) {
  return `${STORAGE_PREFIX}_${restaurantId || "default"}`;
}

export function loadAcknowledgedOrderIds(restaurantId) {
  const payload = readStorage(getStorageKey(restaurantId), { acknowledgedOrderIds: [] });
  return new Set(Array.isArray(payload.acknowledgedOrderIds) ? payload.acknowledgedOrderIds : []);
}

export function saveAcknowledgedOrderIds(restaurantId, acknowledgedSet) {
  writeStorage(getStorageKey(restaurantId), {
    acknowledgedOrderIds: [...acknowledgedSet]
  });
}

export function createNotificationEntry({ order, type, panel }) {
  const orderId = order?.id;
  if (!orderId) {
    return null;
  }

  const now = new Date().toISOString();
  const labels = {
    NEW_ORDER: "New order",
    ORDER_READY: "Order ready",
    ORDER_CANCELLED: "Order cancelled"
  };

  return {
    id: `${orderId}:${type}:${now}`,
    orderId,
    type,
    panel,
    orderCode: order.orderCode || order.id,
    status: order.status,
    orderType: order.orderType,
    tableName: order.table?.name || null,
    customerName: order.customerName || null,
    message: labels[type] || "Order update",
    createdAt: now,
    read: false
  };
}
