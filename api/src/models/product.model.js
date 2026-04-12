function centsToAmount(value) {
  return Number(value || 0) / 100;
}

function amountToCents(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("price must be a valid positive number.");
  }

  return Math.round(parsed * 100);
}

function mapProductRecord(record) {
  if (!record) {
    return null;
  }

  return {
    _id: record.id,
    name: record.name,
    category: record.category,
    price: centsToAmount(record.priceCents),
    isAvailable: Boolean(record.isAvailable)
  };
}

module.exports = {
  PRODUCT_MODEL_NAME: "menuItem",
  amountToCents,
  centsToAmount,
  mapProductRecord
};
