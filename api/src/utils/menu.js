const EPSILON = 0.000001;

const MENU_ITEM_AVAILABILITY_INCLUDE = {
  recipe: {
    include: {
      ingredients: {
        include: {
          ingredient: {
            include: {
              stock: true
            }
          }
        },
        orderBy: [{ createdAt: "asc" }]
      }
    }
  }
};

function toNumber(value) {
  return Number(value || 0);
}

function floorQuantity(value) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return Math.max(0, Math.floor(numericValue + EPSILON));
}

function buildAvailabilityText(reason, availableStock, options = {}) {
  if (reason === "HIDDEN") {
    return "Hidden from menu";
  }
  if (reason === "RECIPE_INCOMPLETE") {
    return "Recipe is incomplete";
  }
  if (reason === "INSUFFICIENT_INGREDIENTS") {
    return "Ingredients are not enough";
  }
  if (reason === "OUT_OF_STOCK") {
    return "Out of stock";
  }
  if (options.recipeLimited) {
    return `Ingredient limited: ${availableStock} left`;
  }

  return `${availableStock} left`;
}

function getMenuItemAvailability(item, options = {}) {
  const previousQuantity = Math.max(0, Number(options.previousQuantity || 0));
  const stock = Math.max(0, toNumber(item?.stock));
  const stockWithReservation = stock + previousQuantity;
  const hasRecipe = Boolean(item?.recipe);
  const recipeApprovalStatus = String(item?.recipe?.approvalStatus || "").trim().toUpperCase() || null;
  const recipeIngredients = Array.isArray(item?.recipe?.ingredients) ? item.recipe.ingredients : null;
  const ingredientShortages = [];

  let ingredientCapacity = null;
  if (hasRecipe && recipeIngredients) {
    if (recipeIngredients.length === 0) {
      ingredientCapacity = 0;
    } else {
      ingredientCapacity = recipeIngredients.reduce((lowestCapacity, recipeIngredient) => {
        const requiredQuantity = toNumber(recipeIngredient?.quantity);
        const currentStock = toNumber(recipeIngredient?.ingredient?.stock?.currentStock);
        const capacity = requiredQuantity > 0 ? floorQuantity(currentStock / requiredQuantity) : 0;

        if (currentStock + EPSILON < requiredQuantity) {
          ingredientShortages.push({
            ingredientId: recipeIngredient?.ingredientId || null,
            name: recipeIngredient?.ingredient?.name || "Ingredient",
            currentStock,
            requiredQuantity,
            unit: recipeIngredient?.ingredient?.unit || null
          });
        }

        return Math.min(lowestCapacity, capacity);
      }, Number.POSITIVE_INFINITY);

      if (!Number.isFinite(ingredientCapacity)) {
        ingredientCapacity = 0;
      }
    }
  }

  const availableStock = floorQuantity(
    ingredientCapacity === null ? stockWithReservation : Math.min(stockWithReservation, ingredientCapacity)
  );
  const recipeLimited = ingredientCapacity !== null && ingredientCapacity < stockWithReservation;

  let availabilityReason = null;
  if (!item?.isAvailable) {
    availabilityReason = "HIDDEN";
  } else if (hasRecipe && recipeIngredients && recipeIngredients.length === 0) {
    availabilityReason = "RECIPE_INCOMPLETE";
  } else if (stockWithReservation <= 0) {
    availabilityReason = "OUT_OF_STOCK";
  } else if (ingredientCapacity !== null && ingredientCapacity <= 0) {
    availabilityReason = "INSUFFICIENT_INGREDIENTS";
  } else if (availableStock <= 0) {
    availabilityReason = "OUT_OF_STOCK";
  }

  return {
    hasRecipe,
    recipeIngredientCount: recipeIngredients?.length || 0,
    ingredientCapacity,
    ingredientShortages,
    stockWithReservation,
    availableStock,
    recipeLimited,
    recipeApprovalStatus,
    availabilityReason,
    availabilityText: buildAvailabilityText(availabilityReason, availableStock, { recipeLimited }),
    isOrderable: !availabilityReason && availableStock > 0
  };
}

function mapMenuItem(item, options = {}) {
  const availability = getMenuItemAvailability(item, options);

  return {
    id: item.id,
    productId: item.id,
    name: item.name,
    category: item.category,
    description: item.description || null,
    photoUrl: item.photoUrl || null,
    priceCents: item.priceCents,
    price: item.priceCents / 100,
    stock: item.stock,
    orderableStock: availability.availableStock,
    isAvailable: item.isAvailable,
    isOrderable: availability.isOrderable,
    availabilityReason: availability.availabilityReason,
    availabilityText: availability.availabilityText,
    ingredientShortages: availability.ingredientShortages,
    ingredientCapacity: availability.ingredientCapacity,
    hasRecipe: availability.hasRecipe,
    recipeId: item.recipe?.id || null,
    recipeApprovalStatus: availability.recipeApprovalStatus,
    recipeApproved: availability.recipeApprovalStatus === "APPROVED",
    recipeSubmittedByName: item.recipe?.submittedByName || null,
    recipeLastSubmittedAt: item.recipe?.lastSubmittedAt || null,
    recipeApprovedByName: item.recipe?.approvedByName || null,
    recipeApprovedAt: item.recipe?.approvedAt || null,
    recipeIngredientCount: availability.recipeIngredientCount,
    recipeLimited: availability.recipeLimited,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

async function listMenuItems(client, restaurantId, options = {}) {
  const includeHidden = Boolean(options.includeHidden);
  const includeUnavailable = Boolean(options.includeUnavailable);
  const items = await client.menuItem.findMany({
    where: {
      restaurantId,
      ...(includeHidden
        ? {}
        : {
            isAvailable: true
          })
    },
    include: MENU_ITEM_AVAILABILITY_INCLUDE,
    orderBy: [{ category: "asc" }, { name: "asc" }]
  });

  const mappedItems = items.map((item) => mapMenuItem(item));
  return includeUnavailable ? mappedItems : mappedItems.filter((item) => item.isOrderable);
}

async function buildOrderDraft(client, restaurantId, rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: { status: 400, message: "items must contain at least one product." } };
  }

  const normalizedItems = rawItems.map((item) => ({
    productId: String(item?.productId || item?.menuItemId || "").trim(),
    quantity: Number(item?.quantity),
    notes: String(item?.notes || "").trim() || null
  }));

  const productIds = [...new Set(normalizedItems.map((item) => item.productId).filter(Boolean))];
  if (productIds.length === 0) {
    return { error: { status: 400, message: "Each order item must include productId." } };
  }

  const products = await client.menuItem.findMany({
    where: {
      restaurantId,
      id: {
        in: productIds
      }
    },
    include: MENU_ITEM_AVAILABILITY_INCLUDE
  });

  const productMap = new Map(products.map((product) => [product.id, product]));
  const orderItems = [];
  let totalCents = 0;

  for (const item of normalizedItems) {
    if (!item.productId) {
      return { error: { status: 400, message: "Each order item must include productId." } };
    }

    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      return { error: { status: 400, message: "quantity must be a whole number between 1 and 20." } };
    }

    const product = productMap.get(item.productId);
    const availability = getMenuItemAvailability(product);

    if (!product || !product.isAvailable || !availability.isOrderable) {
      return { error: { status: 400, message: "One or more selected products are unavailable." } };
    }

    if (availability.availableStock < item.quantity) {
      return {
        error: {
          status: 409,
          message: `Only ${availability.availableStock} left for ${product.name}.`
        }
      };
    }

    orderItems.push({
      restaurantId,
      menuItemId: product.id,
      nameSnapshot: product.name,
      priceCents: product.priceCents,
      quantity: item.quantity,
      notes: item.notes
    });
    totalCents += product.priceCents * item.quantity;
  }

  return {
    orderItems,
    totalCents
  };
}

async function fetchAvailableMenuItems(client, restaurantId) {
  return listMenuItems(client, restaurantId);
}

module.exports = {
  buildOrderDraft,
  fetchAvailableMenuItems,
  getMenuItemAvailability,
  listMenuItems,
  mapMenuItem,
  MENU_ITEM_AVAILABILITY_INCLUDE
};
