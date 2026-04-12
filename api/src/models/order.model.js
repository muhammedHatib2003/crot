function centsToAmount(value) {
  return Number(value || 0) / 100;
}

const DB_ORDER_STATUSES = {
  pending: "PENDING",
  sent_to_kitchen: "SENT_TO_KITCHEN",
  preparing: "PREPARING",
  ready: "READY",
  paid: "PAID"
};

function toDbOrderStatus(status) {
  return DB_ORDER_STATUSES[String(status || "").trim().toLowerCase()] || null;
}

function toApiOrderStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();

  switch (normalized) {
    case "PENDING":
      return "pending";
    case "SENT_TO_KITCHEN":
    case "ACCEPTED":
      return "sent_to_kitchen";
    case "PREPARING":
      return "preparing";
    case "READY":
      return "ready";
    case "PAID":
    case "COMPLETED":
      return "paid";
    default:
      return normalized.toLowerCase();
  }
}

function mapOrderItemRecord(item) {
  return {
    productId: item.menuItemId,
    quantity: item.quantity,
    notes: item.notes || null
  };
}

function mapOrderRecord(record) {
  if (!record) {
    return null;
  }

  return {
    _id: record.id,
    tableNumber: record.tableNumber || record.table?.name || null,
    items: (record.items || []).map(mapOrderItemRecord),
    status: toApiOrderStatus(record.status),
    createdAt: record.createdAt,
    totalAmount: centsToAmount(record.totalCents)
  };
}

const orderDetailsInclude = {
  items: true,
  table: true,
  kitchenOrder: true,
  payment: true
};

module.exports = {
  ORDER_MODEL_NAME: "order",
  DB_ORDER_STATUSES,
  mapOrderItemRecord,
  mapOrderRecord,
  orderDetailsInclude,
  toApiOrderStatus,
  toDbOrderStatus
};
