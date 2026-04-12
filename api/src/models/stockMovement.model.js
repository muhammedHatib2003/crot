const { decimalToNumber } = require("./ingredient.model");

const DB_STOCK_MOVEMENT_REASONS = {
  sale: "SALE",
  manual_entry: "MANUAL_ENTRY",
  waste: "WASTE"
};

function toDbStockMovementReason(reason) {
  return DB_STOCK_MOVEMENT_REASONS[String(reason || "").trim().toLowerCase()] || null;
}

function toApiStockMovementReason(reason) {
  const normalized = String(reason || "").trim().toUpperCase();

  switch (normalized) {
    case "ORDER_CONSUMPTION":
      return "sale";
    case "MANUAL_ENTRY":
    case "ADJUSTMENT":
    case "PURCHASE":
      return "manual_entry";
    case "WASTE":
      return "waste";
    default:
      return normalized.toLowerCase();
  }
}

function mapStockMovementRecord(record) {
  if (!record) {
    return null;
  }

  return {
    _id: record.id,
    stockItemId: record.ingredientId,
    changeAmount: decimalToNumber(record.quantity),
    reason: toApiStockMovementReason(record.type),
    orderId: record.orderId || null,
    createdAt: record.createdAt
  };
}

module.exports = {
  STOCK_MOVEMENT_MODEL_NAME: "stockMovement",
  DB_STOCK_MOVEMENT_REASONS,
  mapStockMovementRecord,
  toApiStockMovementReason,
  toDbStockMovementReason
};
