const DB_KITCHEN_ORDER_STATUSES = {
  waiting: "WAITING",
  preparing: "PREPARING",
  done: "DONE"
};

function toDbKitchenOrderStatus(status) {
  return DB_KITCHEN_ORDER_STATUSES[String(status || "").trim().toLowerCase()] || null;
}

function toApiKitchenOrderStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function mapKitchenOrderRecord(record) {
  if (!record) {
    return null;
  }

  return {
    _id: record.id,
    orderId: record.orderId,
    items: Array.isArray(record.items) ? record.items : [],
    status: toApiKitchenOrderStatus(record.status),
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    createdAt: record.createdAt
  };
}

const kitchenOrderDetailsInclude = {
  order: {
    include: {
      items: true,
      table: true
    }
  }
};

module.exports = {
  KITCHEN_ORDER_MODEL_NAME: "kitchenOrder",
  DB_KITCHEN_ORDER_STATUSES,
  kitchenOrderDetailsInclude,
  mapKitchenOrderRecord,
  toApiKitchenOrderStatus,
  toDbKitchenOrderStatus
};
