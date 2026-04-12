function decimalToNumber(value) {
  return Number(value || 0);
}

function mapIngredientRecord(record) {
  if (!record) {
    return null;
  }

  return {
    _id: record.id,
    productId: record.recipe?.menuItemId || null,
    stockItemId: record.ingredientId,
    quantityRequired: decimalToNumber(record.quantity)
  };
}

module.exports = {
  INGREDIENT_MODEL_NAME: "recipeIngredient",
  decimalToNumber,
  mapIngredientRecord
};
