const { Prisma } = require("@prisma/client");
const { mapProductRecord } = require("../models/product.model");
const { decimalToNumber } = require("../models/ingredient.model");
const { mapStockItemRecord } = require("../models/stockItem.model");
const { mapStockMovementRecord } = require("../models/stockMovement.model");

const EPSILON = 0.000001;

class StockServiceError extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.name = "StockServiceError";
    this.status = status;
    this.details = details;
  }
}

function roundQuantity(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function toDecimal(value) {
  return new Prisma.Decimal(roundQuantity(value));
}

function normalizeQuantity(rawValue, options = {}) {
  const parsed = Number(rawValue);
  const normalized = roundQuantity(parsed);
  const allowZero = Boolean(options.allowZero);

  if (!Number.isFinite(parsed)) {
    throw new StockServiceError("quantity must be a valid number.");
  }

  if (!allowZero && normalized <= 0) {
    throw new StockServiceError("quantity must be greater than zero.");
  }

  return normalized;
}

function buildWarningMessage(lowStockItems) {
  if (!Array.isArray(lowStockItems) || lowStockItems.length === 0) {
    return "";
  }

  return `Low stock: ${lowStockItems.join(", ")}`;
}

function buildStockItemSnapshot(stockItem, nextQuantity) {
  return mapStockItemRecord({
    ...stockItem,
    stock: {
      ...(stockItem.stock || {}),
      currentStock: toDecimal(nextQuantity),
      updatedAt: new Date()
    }
  });
}

async function runInSerializableTransaction(prismaClient, callback, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await prismaClient.$transaction((tx) => callback(tx), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    } catch (error) {
      if (error?.code !== "P2034" || attempt === maxRetries - 1) {
        throw error;
      }
    }
  }

  throw new StockServiceError("Transaction failed after retrying.", 409);
}

async function getStockItemOrThrow(client, restaurantId, stockItemId) {
  const stockItem = await client.ingredient.findFirst({
    where: {
      id: stockItemId,
      restaurantId
    },
    include: {
      stock: true
    }
  });

  if (!stockItem) {
    throw new StockServiceError("Stock item not found.", 404);
  }

  return stockItem;
}

async function buildStockRequirements(client, restaurantId, items) {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const recipes = await client.recipe.findMany({
    where: {
      restaurantId,
      menuItemId: {
        in: productIds
      }
    },
    include: {
      menuItem: true,
      ingredients: {
        include: {
          ingredient: {
            include: {
              stock: true
            }
          }
        }
      }
    }
  });

  const recipeMap = new Map(recipes.map((recipe) => [recipe.menuItemId, recipe]));
  const missingProducts = [];
  const requirements = new Map();

  for (const item of items) {
    const recipe = recipeMap.get(item.productId);

    if (!recipe) {
      missingProducts.push(item.name || item.productId);
      continue;
    }

    if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      throw new StockServiceError(`Product "${recipe.menuItem.name}" does not have ingredients configured.`, 409);
    }

    for (const recipeIngredient of recipe.ingredients) {
      const key = recipeIngredient.ingredientId;
      const current = requirements.get(key);
      const requiredQuantity = roundQuantity(decimalToNumber(recipeIngredient.quantity) * item.quantity);

      requirements.set(key, {
        stockItemId: key,
        stockItem: recipeIngredient.ingredient,
        quantityRequired: roundQuantity((current?.quantityRequired || 0) + requiredQuantity)
      });
    }
  }

  if (missingProducts.length > 0) {
    throw new StockServiceError("Some ordered products do not have ingredient mappings yet.", 409, {
      products: [...new Set(missingProducts)]
    });
  }

  return [...requirements.values()];
}

async function syncProductAvailabilityForProducts(client, restaurantId, productIds) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return [];
  }

  const products = await client.menuItem.findMany({
    where: {
      restaurantId,
      id: {
        in: productIds
      }
    },
    include: {
      recipe: {
        include: {
          ingredients: {
            include: {
              ingredient: {
                include: {
                  stock: true
                }
              }
            }
          }
        }
      }
    }
  });

  const updates = [];
  const availabilityMap = new Map();

  for (const product of products) {
    if (!product.recipe || !product.recipe.ingredients.length) {
      continue;
    }

    const isAvailable = product.recipe.ingredients.every((item) => {
      const currentQuantity = roundQuantity(decimalToNumber(item.ingredient.stock?.currentStock));
      const minimumThreshold = roundQuantity(decimalToNumber(item.ingredient.minStock));
      return currentQuantity + EPSILON >= minimumThreshold;
    });

    availabilityMap.set(product.id, isAvailable);

    if (product.isAvailable !== isAvailable) {
      updates.push(
        client.menuItem.update({
          where: {
            id: product.id
          },
          data: {
            isAvailable
          }
        })
      );
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }

  return products.map((product) =>
    mapProductRecord({
      ...product,
      isAvailable: availabilityMap.has(product.id) ? availabilityMap.get(product.id) : product.isAvailable
    })
  );
}

async function syncProductAvailabilityForStockItems(client, restaurantId, stockItemIds) {
  if (!Array.isArray(stockItemIds) || stockItemIds.length === 0) {
    return [];
  }

  const recipes = await client.recipe.findMany({
    where: {
      restaurantId,
      ingredients: {
        some: {
          ingredientId: {
            in: stockItemIds
          }
        }
      }
    },
    select: {
      menuItemId: true
    }
  });

  const productIds = [...new Set(recipes.map((recipe) => recipe.menuItemId))];
  return syncProductAvailabilityForProducts(client, restaurantId, productIds);
}

async function deductStockForOrder(client, payload) {
  const restaurantId = String(payload?.restaurantId || "").trim();
  const orderId = String(payload?.orderId || "").trim();
  const orderCode = String(payload?.orderCode || "").trim() || orderId;
  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (!restaurantId) {
    throw new StockServiceError("restaurantId is required.");
  }

  if (!orderId) {
    throw new StockServiceError("orderId is required.");
  }

  if (items.length === 0) {
    throw new StockServiceError("Order must contain at least one item.");
  }

  const requirements = await buildStockRequirements(client, restaurantId, items);
  const shortages = [];

  for (const requirement of requirements) {
    const currentQuantity = roundQuantity(decimalToNumber(requirement.stockItem.stock?.currentStock));
    if (currentQuantity + EPSILON < requirement.quantityRequired) {
      shortages.push({
        stockItemId: requirement.stockItemId,
        stockItemName: requirement.stockItem.name,
        unit: requirement.stockItem.unit,
        currentQuantity,
        requiredQuantity: requirement.quantityRequired,
        shortageQuantity: roundQuantity(requirement.quantityRequired - currentQuantity)
      });
    }
  }

  if (shortages.length > 0) {
    throw new StockServiceError("Insufficient stock for this order.", 409, {
      shortages
    });
  }

  const lowStockItems = [];
  const movements = [];
  const affectedStockItemIds = [];

  for (const requirement of requirements) {
    const currentQuantity = roundQuantity(decimalToNumber(requirement.stockItem.stock?.currentStock));
    const minimumThreshold = roundQuantity(decimalToNumber(requirement.stockItem.minStock));
    const nextQuantity = roundQuantity(currentQuantity - requirement.quantityRequired);

    await client.ingredientStock.upsert({
      where: {
        ingredientId: requirement.stockItemId
      },
      update: {
        restaurantId,
        currentStock: toDecimal(nextQuantity)
      },
      create: {
        restaurantId,
        ingredientId: requirement.stockItemId,
        currentStock: toDecimal(nextQuantity)
      }
    });

    const movement = await client.stockMovement.create({
      data: {
        restaurantId,
        ingredientId: requirement.stockItemId,
        orderId,
        type: "SALE",
        quantity: toDecimal(-requirement.quantityRequired),
        referenceType: "ORDER",
        referenceId: orderId,
        note: `Auto deduction for order ${orderCode}`
      }
    });

    movements.push(mapStockMovementRecord(movement));
    affectedStockItemIds.push(requirement.stockItemId);

    if (nextQuantity < minimumThreshold) {
      lowStockItems.push(requirement.stockItem.name);
    }
  }

  await syncProductAvailabilityForStockItems(client, restaurantId, affectedStockItemIds);

  return {
    movements,
    lowStockItems: [...new Set(lowStockItems)],
    warning: buildWarningMessage([...new Set(lowStockItems)])
  };
}

async function createManualStockEntry(client, payload) {
  const restaurantId = String(payload?.restaurantId || "").trim();
  const stockItemId = String(payload?.stockItemId || "").trim();
  const quantity = normalizeQuantity(payload?.quantity);
  const note = String(payload?.note || "").trim() || "Manual stock entry";

  if (!restaurantId) {
    throw new StockServiceError("restaurantId is required.");
  }

  if (!stockItemId) {
    throw new StockServiceError("stockItemId is required.");
  }

  return runInSerializableTransaction(client, async (tx) => {
    const stockItem = await getStockItemOrThrow(tx, restaurantId, stockItemId);
    const currentQuantity = roundQuantity(decimalToNumber(stockItem.stock?.currentStock));
    const nextQuantity = roundQuantity(currentQuantity + quantity);

    await tx.ingredientStock.upsert({
      where: {
        ingredientId: stockItem.id
      },
      update: {
        restaurantId,
        currentStock: toDecimal(nextQuantity)
      },
      create: {
        restaurantId,
        ingredientId: stockItem.id,
        currentStock: toDecimal(nextQuantity)
      }
    });

    const movement = await tx.stockMovement.create({
      data: {
        restaurantId,
        ingredientId: stockItem.id,
        type: "MANUAL_ENTRY",
        quantity: toDecimal(quantity),
        referenceType: "MANUAL",
        note
      }
    });

    const affectedProducts = await syncProductAvailabilityForStockItems(tx, restaurantId, [stockItem.id]);

    return {
      stockItem: buildStockItemSnapshot(stockItem, nextQuantity),
      affectedProducts,
      movement: mapStockMovementRecord(movement)
    };
  });
}

async function listStockItems(client, restaurantId) {
  const items = await client.ingredient.findMany({
    where: {
      restaurantId
    },
    include: {
      stock: true
    },
    orderBy: [{ name: "asc" }]
  });

  return items.map(mapStockItemRecord);
}

async function listStockMovements(client, restaurantId) {
  const movements = await client.stockMovement.findMany({
    where: {
      restaurantId
    },
    include: {
      ingredient: {
        include: {
          stock: true
        }
      },
      order: true
    },
    orderBy: [{ createdAt: "desc" }]
  });

  return movements.map((movement) => ({
    ...mapStockMovementRecord(movement),
    stockItem: movement.ingredient ? mapStockItemRecord(movement.ingredient) : null,
    orderNumber: movement.order?.orderCode || null
  }));
}

async function getLowStockAlerts(client, restaurantId) {
  const stockItems = await client.ingredient.findMany({
    where: {
      restaurantId
    },
    include: {
      stock: true,
      recipeIngredients: {
        include: {
          recipe: {
            include: {
              menuItem: true
            }
          }
        }
      }
    },
    orderBy: [{ name: "asc" }]
  });

  return stockItems
    .filter((item) => roundQuantity(decimalToNumber(item.stock?.currentStock)) < roundQuantity(decimalToNumber(item.minStock)))
    .map((item) => ({
      ...mapStockItemRecord(item),
      affectedProducts: [...new Set(
        item.recipeIngredients
          .map((recipeIngredient) => recipeIngredient.recipe?.menuItem?.name)
          .filter(Boolean)
      )]
    }));
}

module.exports = {
  StockServiceError,
  createManualStockEntry,
  deductStockForOrder,
  getLowStockAlerts,
  listStockItems,
  listStockMovements,
  normalizeQuantity,
  runInSerializableTransaction,
  syncProductAvailabilityForProducts,
  syncProductAvailabilityForStockItems
};
