const { decimalToNumber } = require("./ingredient.model");

function mapStockItemRecord(record) {
  if (!record) {
    return null;
  }

  return {
    _id: record.id,
    name: record.name,
    unit: record.unit,
    currentQuantity: decimalToNumber(record.stock?.currentStock),
    minimumThreshold: decimalToNumber(record.minStock),
    lastUpdated: record.stock?.updatedAt || record.updatedAt
  };
}

module.exports = {
  STOCK_ITEM_MODEL_NAME: "ingredient",
  mapStockItemRecord
};
