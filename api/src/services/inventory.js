const { Prisma } = require("@prisma/client");

const MANUAL_MOVEMENT_TYPES = new Set(["PURCHASE", "WASTE", "ADJUSTMENT", "RETURN"]);
const RECIPE_APPROVAL_STATUSES = new Set(["PENDING_APPROVAL", "APPROVED"]);
const INGREDIENT_REQUEST_STATUSES = new Set(["PENDING", "FULFILLED", "REJECTED"]);
const EPSILON = 0.000001;

class InventoryError extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.name = "InventoryError";
    this.status = status;
    this.details = details;
  }
}

function decimalToNumber(value) {
  return Number(value || 0);
}

function roundQuantity(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function toDecimal(value) {
  return new Prisma.Decimal(roundQuantity(value));
}

function normalizeQuantity(rawValue, options = {}) {
  const value = Number(rawValue);
  const normalized = roundQuantity(value);
  const allowZero = Boolean(options.allowZero);

  if (!Number.isFinite(value)) {
    throw new InventoryError("quantity must be a valid number.");
  }

  if (!allowZero && Math.abs(normalized) < EPSILON) {
    throw new InventoryError("quantity must not be zero.");
  }

  return normalized;
}

function parsePriceToCents(rawValue, options = {}) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0 || (!options.allowZero && parsed === 0)) {
    throw new InventoryError("unitCost must be a valid number greater than or equal to zero.");
  }

  return Math.round(parsed * 100);
}

function buildOptionalNote(note) {
  const normalized = String(note || "").trim();
  return normalized || null;
}

function normalizeEmployeeRole(employeeRole) {
  return String(employeeRole || "").trim().toLowerCase();
}

function normalizeRecipeApprovalStatus(value, fallback = "APPROVED") {
  const normalized = String(value || fallback).trim().toUpperCase();

  if (!RECIPE_APPROVAL_STATUSES.has(normalized)) {
    throw new InventoryError("approvalStatus must be one of: PENDING_APPROVAL, APPROVED.");
  }

  return normalized;
}

function normalizeIngredientRequestStatus(value, fallback = "PENDING") {
  const normalized = String(value || fallback).trim().toUpperCase();

  if (!INGREDIENT_REQUEST_STATUSES.has(normalized)) {
    throw new InventoryError("status must be one of: PENDING, FULFILLED, REJECTED.");
  }

  return normalized;
}

function mapIngredient(ingredient) {
  const currentStock = roundQuantity(decimalToNumber(ingredient.stock?.currentStock));
  const minStock = roundQuantity(decimalToNumber(ingredient.minStock));

  return {
    id: ingredient.id,
    name: ingredient.name,
    unit: ingredient.unit,
    minStock,
    currentStock,
    isLowStock: currentStock <= minStock,
    createdAt: ingredient.createdAt,
    updatedAt: ingredient.updatedAt
  };
}

function mapRecipeIngredient(item) {
  return {
    id: item.id,
    ingredientId: item.ingredientId,
    quantity: roundQuantity(decimalToNumber(item.quantity)),
    ingredient: item.ingredient
      ? {
          id: item.ingredient.id,
          name: item.ingredient.name,
          unit: item.ingredient.unit,
          currentStock: roundQuantity(decimalToNumber(item.ingredient.stock?.currentStock))
        }
      : null
  };
}

function mapRecipe(recipe) {
  if (!recipe) {
    return null;
  }

  return {
    id: recipe.id,
    menuItemId: recipe.menuItemId,
    approvalStatus: normalizeRecipeApprovalStatus(recipe.approvalStatus, "APPROVED"),
    submittedByName: recipe.submittedByName || null,
    lastSubmittedAt: recipe.lastSubmittedAt || null,
    approvedByName: recipe.approvedByName || null,
    approvedAt: recipe.approvedAt || null,
    menuItem: recipe.menuItem
      ? {
          id: recipe.menuItem.id,
          name: recipe.menuItem.name,
          category: recipe.menuItem.category
        }
      : null,
    ingredients: (recipe.ingredients || []).map(mapRecipeIngredient),
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt
  };
}

function mapStockMovement(movement) {
  return {
    id: movement.id,
    ingredientId: movement.ingredientId,
    type: movement.type,
    quantity: roundQuantity(decimalToNumber(movement.quantity)),
    referenceType: movement.referenceType,
    referenceId: movement.referenceId,
    note: movement.note,
    createdAt: movement.createdAt,
    ingredient: movement.ingredient
      ? {
          id: movement.ingredient.id,
          name: movement.ingredient.name,
          unit: movement.ingredient.unit,
          currentStock: roundQuantity(decimalToNumber(movement.ingredient.stock?.currentStock))
        }
      : null
  };
}

function mapIngredientRequest(request) {
  return {
    id: request.id,
    ingredientId: request.ingredientId,
    requestedIngredientName: request.requestedIngredientName || request.ingredient?.name || null,
    requestedUnit: request.requestedUnit || request.ingredient?.unit || null,
    ingredientName: request.ingredient?.name || request.requestedIngredientName || "Ingredient",
    unit: request.ingredient?.unit || request.requestedUnit || null,
    quantity: roundQuantity(decimalToNumber(request.quantity)),
    status: normalizeIngredientRequestStatus(request.status, "PENDING"),
    note: request.note || null,
    requestedByName: request.requestedByName,
    handledByName: request.handledByName || null,
    handledAt: request.handledAt || null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    ingredient: request.ingredient
      ? {
          id: request.ingredient.id,
          name: request.ingredient.name,
          unit: request.ingredient.unit,
          currentStock: roundQuantity(decimalToNumber(request.ingredient.stock?.currentStock))
        }
      : null
  };
}

function mapSupplier(supplier) {
  return {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    email: supplier.email,
    notes: supplier.notes,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
    purchaseOrdersCount: supplier._count?.purchaseOrders ?? undefined
  };
}

function mapPurchaseOrder(order) {
  const items = (order.items || []).map((item) => ({
    id: item.id,
    ingredientId: item.ingredientId,
    quantity: roundQuantity(decimalToNumber(item.quantity)),
    unitCostCents: item.unitCostCents,
    unitCost: item.unitCostCents === null || item.unitCostCents === undefined ? null : item.unitCostCents / 100,
    ingredient: item.ingredient
      ? {
          id: item.ingredient.id,
          name: item.ingredient.name,
          unit: item.ingredient.unit
        }
      : null
  }));

  return {
    id: order.id,
    status: order.status,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    receivedAt: order.receivedAt,
    supplier: order.supplier ? mapSupplier(order.supplier) : null,
    items,
    estimatedTotalCents: items.reduce(
      (sum, item) => sum + (item.unitCostCents || 0) * item.quantity,
      0
    ),
    estimatedTotal:
      items.reduce((sum, item) => sum + (item.unitCostCents || 0) * item.quantity, 0) / 100
  };
}

function mapMenuItemRecipeSummary(menuItem) {
  return {
    id: menuItem.id,
    name: menuItem.name,
    category: menuItem.category,
    priceCents: menuItem.priceCents,
    price: menuItem.priceCents / 100,
    isAvailable: menuItem.isAvailable,
    recipeId: menuItem.recipe?.id || null,
    hasRecipe: Boolean(menuItem.recipe),
    recipeApprovalStatus: menuItem.recipe ? normalizeRecipeApprovalStatus(menuItem.recipe.approvalStatus, "APPROVED") : null,
    recipeApproved: menuItem.recipe ? normalizeRecipeApprovalStatus(menuItem.recipe.approvalStatus, "APPROVED") === "APPROVED" : false
  };
}

function sanitizeIngredientInput(payload, options = {}) {
  const name = String(payload?.name || "").trim();
  const unit = String(payload?.unit || "").trim();
  const hasMinStock = Object.prototype.hasOwnProperty.call(payload || {}, "minStock");
  const minStock = hasMinStock ? normalizeQuantity(payload.minStock, { allowZero: true }) : null;

  if (!options.partial && !name) {
    throw new InventoryError("name is required.");
  }

  if (!options.partial && !unit) {
    throw new InventoryError("unit is required.");
  }

  if (hasMinStock && minStock < 0) {
    throw new InventoryError("minStock must be zero or greater.");
  }

  const data = {};
  if (name) {
    data.name = name;
  }
  if (unit) {
    data.unit = unit;
  }
  if (hasMinStock) {
    data.minStock = minStock;
  } else if (!options.partial) {
    data.minStock = 0;
  }

  return data;
}

function sanitizeSupplierInput(payload, options = {}) {
  const name = String(payload?.name || "").trim();
  const phone = String(payload?.phone || "").trim();
  const email = String(payload?.email || "").trim().toLowerCase();
  const notes = String(payload?.notes || "").trim();

  if (!options.partial && !name) {
    throw new InventoryError("name is required.");
  }

  const data = {};
  if (name) {
    data.name = name;
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, "phone")) {
    data.phone = phone || null;
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, "email")) {
    data.email = email || null;
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, "notes")) {
    data.notes = notes || null;
  }

  return data;
}

async function getIngredientOrThrow(client, restaurantId, ingredientId, includeStock = true) {
  const ingredient = await client.ingredient.findFirst({
    where: {
      id: ingredientId,
      restaurantId
    },
    include: includeStock
      ? {
          stock: true
        }
      : undefined
  });

  if (!ingredient) {
    throw new InventoryError("Ingredient not found.", 404);
  }

  return ingredient;
}

async function getSupplierOrThrow(client, restaurantId, supplierId) {
  const supplier = await client.supplier.findFirst({
    where: {
      id: supplierId,
      restaurantId
    }
  });

  if (!supplier) {
    throw new InventoryError("Supplier not found.", 404);
  }

  return supplier;
}

async function applyStockMovement(client, restaurantId, payload) {
  const ingredient = await getIngredientOrThrow(client, restaurantId, payload.ingredientId, true);
  const currentStock = roundQuantity(decimalToNumber(ingredient.stock?.currentStock));
  const nextStock = roundQuantity(currentStock + payload.quantity);

  await client.ingredientStock.upsert({
    where: {
      ingredientId: ingredient.id
    },
    update: {
      restaurantId,
      currentStock: toDecimal(nextStock)
    },
    create: {
      restaurantId,
      ingredientId: ingredient.id,
      currentStock: toDecimal(nextStock)
    }
  });

  const movement = await client.stockMovement.create({
    data: {
      restaurantId,
      ingredientId: ingredient.id,
      type: payload.type,
      quantity: toDecimal(payload.quantity),
      referenceType: payload.referenceType || null,
      referenceId: payload.referenceId || null,
      note: buildOptionalNote(payload.note)
    },
    include: {
      ingredient: {
        include: {
          stock: true
        }
      }
    }
  });

  return mapStockMovement(movement);
}

async function listIngredientsWithStock(client, restaurantId) {
  const ingredients = await client.ingredient.findMany({
    where: {
      restaurantId
    },
    include: {
      stock: true
    },
    orderBy: [{ name: "asc" }]
  });

  return ingredients.map(mapIngredient);
}

async function createIngredient(client, restaurantId, payload) {
  const data = sanitizeIngredientInput(payload);

  try {
    const ingredient = await client.ingredient.create({
      data: {
        name: data.name,
        unit: data.unit,
        minStock: toDecimal(data.minStock),
        restaurantId,
        stock: {
          create: {
            restaurantId,
            currentStock: toDecimal(0)
          }
        }
      },
      include: {
        stock: true
      }
    });

    return mapIngredient(ingredient);
  } catch (error) {
    if (error?.code === "P2002") {
      throw new InventoryError("Ingredient name already exists in this restaurant.", 409);
    }

    throw error;
  }
}

async function updateIngredient(client, restaurantId, ingredientId, payload) {
  const existingIngredient = await getIngredientOrThrow(client, restaurantId, ingredientId, false);
  const data = sanitizeIngredientInput(payload, { partial: true });

  if (Object.keys(data).length === 0) {
    throw new InventoryError("No valid fields provided.");
  }

  try {
    const ingredient = await client.ingredient.update({
      where: {
        id: existingIngredient.id
      },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.unit ? { unit: data.unit } : {}),
        ...(Object.prototype.hasOwnProperty.call(data, "minStock") ? { minStock: toDecimal(data.minStock) } : {})
      },
      include: {
        stock: true
      }
    });

    return mapIngredient(ingredient);
  } catch (error) {
    if (error?.code === "P2002") {
      throw new InventoryError("Ingredient name already exists in this restaurant.", 409);
    }

    throw error;
  }
}

async function getIngredientMovementHistory(client, restaurantId, ingredientId, take = 50) {
  const ingredient = await getIngredientOrThrow(client, restaurantId, ingredientId, true);
  const movements = await client.stockMovement.findMany({
    where: {
      restaurantId,
      ingredientId
    },
    include: {
      ingredient: {
        include: {
          stock: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }],
    take
  });

  return {
    ingredient: mapIngredient(ingredient),
    movements: movements.map(mapStockMovement)
  };
}

function assertManualMovementType(type) {
  if (!MANUAL_MOVEMENT_TYPES.has(type)) {
    throw new InventoryError("type must be one of: PURCHASE, WASTE, ADJUSTMENT, RETURN.");
  }
}

function assertManualMovementQuantity(type, quantity) {
  if ((type === "PURCHASE" || type === "RETURN") && quantity <= 0) {
    throw new InventoryError(`${type} quantity must be positive.`);
  }

  if (type === "WASTE" && quantity >= 0) {
    throw new InventoryError("WASTE quantity must be negative.");
  }

  if (type === "ADJUSTMENT" && Math.abs(quantity) < EPSILON) {
    throw new InventoryError("ADJUSTMENT quantity must not be zero.");
  }
}

async function createManualStockMovement(client, restaurantId, payload) {
  const ingredientId = String(payload?.ingredientId || "").trim();
  const type = String(payload?.type || "").trim().toUpperCase();
  const quantity = normalizeQuantity(payload?.quantity);

  if (!ingredientId) {
    throw new InventoryError("ingredientId is required.");
  }

  assertManualMovementType(type);
  assertManualMovementQuantity(type, quantity);

  return applyStockMovement(client, restaurantId, {
    ingredientId,
    type,
    quantity,
    referenceType: "MANUAL",
    note: payload?.note
  });
}

async function listStockMovements(client, restaurantId, options = {}) {
  const take = Math.min(Math.max(Number(options.take) || 50, 1), 200);
  const movements = await client.stockMovement.findMany({
    where: {
      restaurantId
    },
    include: {
      ingredient: {
        include: {
          stock: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }],
    take
  });

  return movements.map(mapStockMovement);
}

async function listIngredientRequests(client, restaurantId, options = {}) {
  const status = options.status ? normalizeIngredientRequestStatus(options.status) : null;
  const requests = await client.ingredientRequest.findMany({
    where: {
      restaurantId,
      ...(status ? { status } : {})
    },
    include: {
      ingredient: {
        include: {
          stock: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  return requests.map(mapIngredientRequest);
}

async function createIngredientRequest(client, restaurantId, payload) {
  const requestedByName = String(payload?.requestedByName || "").trim();
  const requestedIngredientNameInput = String(payload?.requestedIngredientName || "").trim();
  const requestedUnitInput = String(payload?.requestedUnit || "").trim();
  const note = buildOptionalNote(payload?.note);
  const quantity = normalizeQuantity(payload?.quantity);
  const ingredientId = String(payload?.ingredientId || "").trim();

  if (!requestedByName) {
    throw new InventoryError("requestedByName is required.");
  }

  let ingredient = null;
  if (ingredientId) {
    ingredient = await getIngredientOrThrow(client, restaurantId, ingredientId, true);
  } else if (requestedIngredientNameInput) {
    ingredient = await client.ingredient.findFirst({
      where: {
        restaurantId,
        name: requestedIngredientNameInput
      },
      include: {
        stock: true
      }
    });
  }

  const requestedIngredientName = ingredient?.name || requestedIngredientNameInput;
  const requestedUnit = ingredient?.unit || requestedUnitInput || null;

  if (!requestedIngredientName) {
    throw new InventoryError("ingredientId or requestedIngredientName is required.");
  }

  if (!ingredient && !requestedUnit) {
    throw new InventoryError("requestedUnit is required when the ingredient is missing from inventory.");
  }

  const request = await client.ingredientRequest.create({
    data: {
      restaurantId,
      ingredientId: ingredient?.id || null,
      requestedIngredientName,
      requestedUnit,
      quantity: toDecimal(quantity),
      status: "PENDING",
      note,
      requestedByName
    },
    include: {
      ingredient: {
        include: {
          stock: true
        }
      }
    }
  });

  return mapIngredientRequest(request);
}

async function updateIngredientRequestStatus(client, restaurantId, requestId, payload) {
  const status = normalizeIngredientRequestStatus(payload?.status);
  const handledByName = String(payload?.handledByName || "").trim();

  const request = await client.ingredientRequest.findFirst({
    where: {
      id: requestId,
      restaurantId
    }
  });

  if (!request) {
    throw new InventoryError("Ingredient request not found.", 404);
  }

  let nextIngredientId = request.ingredientId;
  if (!nextIngredientId && request.requestedIngredientName) {
    const matchingIngredient = await client.ingredient.findFirst({
      where: {
        restaurantId,
        name: request.requestedIngredientName
      },
      select: {
        id: true
      }
    });

    nextIngredientId = matchingIngredient?.id || null;
  }

  const nextRequest = await client.ingredientRequest.update({
    where: {
      id: request.id
    },
    data: {
      ingredientId: nextIngredientId,
      status,
      handledByName: status === "PENDING" ? null : handledByName || null,
      handledAt: status === "PENDING" ? null : new Date()
    },
    include: {
      ingredient: {
        include: {
          stock: true
        }
      }
    }
  });

  return mapIngredientRequest(nextRequest);
}

async function getInventoryDashboard(client, restaurantId) {
  const [ingredients, recentMovements, suppliersCount, openPurchaseOrders, pendingIngredientRequests] = await Promise.all([
    listIngredientsWithStock(client, restaurantId),
    listStockMovements(client, restaurantId, { take: 20 }),
    client.supplier.count({
      where: {
        restaurantId
      }
    }),
    client.purchaseOrder.count({
      where: {
        restaurantId,
        status: "DRAFT"
      }
    }),
    client.ingredientRequest.count({
      where: {
        restaurantId,
        status: "PENDING"
      }
    })
  ]);

  const lowStockIngredients = ingredients
    .filter((ingredient) => ingredient.isLowStock)
    .sort((left, right) => left.currentStock - right.currentStock);

  return {
    summary: {
      ingredientsCount: ingredients.length,
      lowStockCount: lowStockIngredients.length,
      suppliersCount,
      openPurchaseOrders,
      pendingIngredientRequests
    },
    ingredients,
    lowStockIngredients,
    recentMovements
  };
}

async function getLowStockAlerts(client, restaurantId) {
  const ingredients = await listIngredientsWithStock(client, restaurantId);
  return ingredients
    .filter((ingredient) => ingredient.isLowStock)
    .map((ingredient) => ({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      currentStock: ingredient.currentStock,
      minStock: ingredient.minStock,
      unit: ingredient.unit
    }));
}

async function getInventoryConsumptionReport(client, restaurantId, dateRange = {}) {
  const where = {
    restaurantId,
    type: "ORDER_CONSUMPTION"
  };

  if (dateRange.from || dateRange.to) {
    where.createdAt = {};
    if (dateRange.from) {
      where.createdAt.gte = dateRange.from;
    }
    if (dateRange.to) {
      where.createdAt.lte = dateRange.to;
    }
  }

  const grouped = await client.stockMovement.groupBy({
    by: ["ingredientId"],
    where,
    _sum: {
      quantity: true
    }
  });

  const ingredientIds = grouped.map((entry) => entry.ingredientId);
  const ingredients = ingredientIds.length
    ? await client.ingredient.findMany({
        where: {
          restaurantId,
          id: {
            in: ingredientIds
          }
        },
        include: {
          stock: true
        },
        orderBy: [{ name: "asc" }]
      })
    : [];

  const groupedMap = new Map(
    grouped.map((entry) => [entry.ingredientId, Math.abs(roundQuantity(decimalToNumber(entry._sum.quantity)))])
  );

  return ingredients.map((ingredient) => ({
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    unit: ingredient.unit,
    consumedQuantity: groupedMap.get(ingredient.id) || 0,
    currentStock: roundQuantity(decimalToNumber(ingredient.stock?.currentStock))
  }));
}

async function listSuppliers(client, restaurantId) {
  const suppliers = await client.supplier.findMany({
    where: {
      restaurantId
    },
    orderBy: [{ name: "asc" }],
    include: {
      _count: {
        select: {
          purchaseOrders: true
        }
      }
    }
  });

  return suppliers.map(mapSupplier);
}

async function createSupplier(client, restaurantId, payload) {
  const data = sanitizeSupplierInput(payload);

  try {
    const supplier = await client.supplier.create({
      data: {
        ...data,
        restaurantId
      },
      include: {
        _count: {
          select: {
            purchaseOrders: true
          }
        }
      }
    });

    return mapSupplier(supplier);
  } catch (error) {
    if (error?.code === "P2002") {
      throw new InventoryError("Supplier name already exists in this restaurant.", 409);
    }

    throw error;
  }
}

async function listPurchaseOrders(client, restaurantId) {
  const orders = await client.purchaseOrder.findMany({
    where: {
      restaurantId
    },
    include: {
      supplier: true,
      items: {
        include: {
          ingredient: true
        },
        orderBy: [{ createdAt: "asc" }]
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  return orders.map(mapPurchaseOrder);
}

async function createPurchaseOrder(client, restaurantId, payload) {
  const supplierId = String(payload?.supplierId || "").trim() || null;
  const notes = buildOptionalNote(payload?.notes);
  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (items.length === 0) {
    throw new InventoryError("items must contain at least one ingredient.");
  }

  if (supplierId) {
    await getSupplierOrThrow(client, restaurantId, supplierId);
  }

  const ingredientIds = [];
  const createItems = [];
  const seenIngredients = new Set();

  for (const item of items) {
    const ingredientId = String(item?.ingredientId || "").trim();
    if (!ingredientId) {
      throw new InventoryError("Each purchase order item must include ingredientId.");
    }
    if (seenIngredients.has(ingredientId)) {
      throw new InventoryError("Purchase order cannot contain duplicate ingredients.");
    }

    seenIngredients.add(ingredientId);
    ingredientIds.push(ingredientId);
    createItems.push({
      ingredientId,
      quantity: toDecimal(normalizeQuantity(item?.quantity)),
      unitCostCents: parsePriceToCents(item?.unitCost, { allowZero: true })
    });
  }

  const ingredients = await client.ingredient.findMany({
    where: {
      restaurantId,
      id: {
        in: ingredientIds
      }
    }
  });

  if (ingredients.length !== ingredientIds.length) {
    throw new InventoryError("One or more ingredients do not belong to this restaurant.", 404);
  }

  const order = await client.purchaseOrder.create({
    data: {
      restaurantId,
      supplierId,
      notes,
      items: {
        create: createItems
      }
    },
    include: {
      supplier: true,
      items: {
        include: {
          ingredient: true
        },
        orderBy: [{ createdAt: "asc" }]
      }
    }
  });

  return mapPurchaseOrder(order);
}

async function receivePurchaseOrder(client, restaurantId, purchaseOrderId) {
  const order = await runSerializableTransaction(client, async (tx) => {
    const purchaseOrder = await tx.purchaseOrder.findFirst({
      where: {
        id: purchaseOrderId,
        restaurantId
      },
      include: {
        supplier: true,
        items: {
          include: {
            ingredient: true
          },
          orderBy: [{ createdAt: "asc" }]
        }
      }
    });

    if (!purchaseOrder) {
      throw new InventoryError("Purchase order not found.", 404);
    }

    if (purchaseOrder.status !== "DRAFT") {
      throw new InventoryError("Only draft purchase orders can be received.", 409);
    }

    for (const item of purchaseOrder.items) {
      await applyStockMovement(tx, restaurantId, {
        ingredientId: item.ingredientId,
        type: "PURCHASE",
        quantity: roundQuantity(decimalToNumber(item.quantity)),
        referenceType: "PURCHASE_ORDER",
        referenceId: purchaseOrder.id,
        note: purchaseOrder.supplier ? `Purchase from ${purchaseOrder.supplier.name}` : "Purchase order received"
      });
    }

    return tx.purchaseOrder.update({
      where: {
        id: purchaseOrder.id
      },
      data: {
        status: "RECEIVED",
        receivedAt: new Date()
      },
      include: {
        supplier: true,
        items: {
          include: {
            ingredient: true
          },
          orderBy: [{ createdAt: "asc" }]
        }
      }
    });
  });

  return mapPurchaseOrder(order);
}

async function listMenuItemsWithRecipes(client, restaurantId) {
  const menuItems = await client.menuItem.findMany({
    where: {
      restaurantId
    },
    include: {
      recipe: {
        select: {
          id: true,
          approvalStatus: true
        }
      }
    },
    orderBy: [{ category: "asc" }, { name: "asc" }]
  });

  return menuItems.map(mapMenuItemRecipeSummary);
}

async function getRecipeForMenuItem(client, restaurantId, menuItemId) {
  const menuItem = await client.menuItem.findFirst({
    where: {
      id: menuItemId,
      restaurantId
    }
  });

  if (!menuItem) {
    throw new InventoryError("Menu item not found.", 404);
  }

  const recipe = await client.recipe.findFirst({
    where: {
      restaurantId,
      menuItemId
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
        },
        orderBy: [{ createdAt: "asc" }]
      }
    }
  });

  return {
    menuItem: {
      id: menuItem.id,
      name: menuItem.name,
      category: menuItem.category
    },
    recipe: mapRecipe(recipe)
  };
}

async function upsertRecipeForMenuItem(client, restaurantId, menuItemId, payload, options = {}) {
  const menuItem = await client.menuItem.findFirst({
    where: {
      id: menuItemId,
      restaurantId
    }
  });

  if (!menuItem) {
    throw new InventoryError("Menu item not found.", 404);
  }

  const items = Array.isArray(payload?.ingredients) ? payload.ingredients : Array.isArray(payload?.items) ? payload.items : [];
  if (items.length === 0) {
    throw new InventoryError("ingredients must contain at least one item.");
  }

  const ingredientIds = [];
  const createIngredients = [];
  const seenIngredients = new Set();

  for (const item of items) {
    const ingredientId = String(item?.ingredientId || "").trim();
    if (!ingredientId) {
      throw new InventoryError("Each recipe ingredient must include ingredientId.");
    }
    if (seenIngredients.has(ingredientId)) {
      throw new InventoryError("Recipe cannot contain the same ingredient more than once.");
    }

    seenIngredients.add(ingredientId);
    ingredientIds.push(ingredientId);
    createIngredients.push({
      ingredientId,
      quantity: toDecimal(normalizeQuantity(item?.quantity))
    });
  }

  const ingredients = await client.ingredient.findMany({
    where: {
      restaurantId,
      id: {
        in: ingredientIds
      }
    }
  });

  if (ingredients.length !== ingredientIds.length) {
    throw new InventoryError("One or more ingredients do not belong to this restaurant.", 404);
  }

  const approvalStatus = normalizeRecipeApprovalStatus(options.approvalStatus, "APPROVED");
  const recipeMeta = {
    approvalStatus,
    submittedByName: Object.prototype.hasOwnProperty.call(options, "submittedByName") ? options.submittedByName || null : undefined,
    lastSubmittedAt: Object.prototype.hasOwnProperty.call(options, "lastSubmittedAt") ? options.lastSubmittedAt || null : undefined,
    approvedByName: Object.prototype.hasOwnProperty.call(options, "approvedByName") ? options.approvedByName || null : undefined,
    approvedAt: Object.prototype.hasOwnProperty.call(options, "approvedAt") ? options.approvedAt || null : undefined
  };

  const recipe = await client.$transaction(async (tx) => {
    const existingRecipe = await tx.recipe.findFirst({
      where: {
        restaurantId,
        menuItemId
      }
    });

    if (existingRecipe) {
      return tx.recipe.update({
        where: {
          id: existingRecipe.id
        },
        data: {
          approvalStatus,
          ...(recipeMeta.submittedByName !== undefined ? { submittedByName: recipeMeta.submittedByName } : {}),
          ...(recipeMeta.lastSubmittedAt !== undefined ? { lastSubmittedAt: recipeMeta.lastSubmittedAt } : {}),
          ...(recipeMeta.approvedByName !== undefined ? { approvedByName: recipeMeta.approvedByName } : {}),
          ...(recipeMeta.approvedAt !== undefined ? { approvedAt: recipeMeta.approvedAt } : {}),
          ingredients: {
            deleteMany: {},
            create: createIngredients
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
            },
            orderBy: [{ createdAt: "asc" }]
          }
        }
      });
    }

    return tx.recipe.create({
      data: {
        restaurantId,
        menuItemId,
        approvalStatus,
        ...(recipeMeta.submittedByName !== undefined ? { submittedByName: recipeMeta.submittedByName } : {}),
        ...(recipeMeta.lastSubmittedAt !== undefined ? { lastSubmittedAt: recipeMeta.lastSubmittedAt } : {}),
        ...(recipeMeta.approvedByName !== undefined ? { approvedByName: recipeMeta.approvedByName } : {}),
        ...(recipeMeta.approvedAt !== undefined ? { approvedAt: recipeMeta.approvedAt } : {}),
        ingredients: {
          create: createIngredients
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
          },
          orderBy: [{ createdAt: "asc" }]
        }
      }
    });
  });

  return mapRecipe(recipe);
}

async function approveRecipeForMenuItem(client, restaurantId, menuItemId, payload = {}) {
  const recipe = await client.recipe.findFirst({
    where: {
      restaurantId,
      menuItemId
    }
  });

  if (!recipe) {
    throw new InventoryError("Recipe not found.", 404);
  }

  const approvedRecipe = await client.recipe.update({
    where: {
      id: recipe.id
    },
    data: {
      approvalStatus: "APPROVED",
      approvedByName: payload?.approvedByName ? String(payload.approvedByName).trim() : null,
      approvedAt: payload?.approvedAt || new Date()
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
        },
        orderBy: [{ createdAt: "asc" }]
      }
    }
  });

  return mapRecipe(approvedRecipe);
}

async function deleteRecipeForMenuItem(client, restaurantId, menuItemId) {
  const recipe = await client.recipe.findFirst({
    where: {
      restaurantId,
      menuItemId
    }
  });

  if (!recipe) {
    throw new InventoryError("Recipe not found.", 404);
  }

  await client.recipe.delete({
    where: {
      id: recipe.id
    }
  });
}

async function buildOrderIngredientRequirements(client, order) {
  const menuItemIds = [...new Set((order.items || []).map((item) => item.menuItemId))];
  if (menuItemIds.length === 0) {
    return [];
  }

  const recipes = await client.recipe.findMany({
    where: {
      restaurantId: order.restaurantId,
      menuItemId: {
        in: menuItemIds
      }
    },
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
  });

  const recipeMap = new Map(recipes.map((recipe) => [recipe.menuItemId, recipe]));
  const requirementMap = new Map();
  const missingRecipeItems = [];

  for (const orderItem of order.items || []) {
    const recipe = recipeMap.get(orderItem.menuItemId);
    if (!recipe) {
      missingRecipeItems.push(orderItem.nameSnapshot);
      continue;
    }

    if (!recipe.ingredients.length) {
      throw new InventoryError(`Recipe for ${orderItem.nameSnapshot} has no ingredients.`, 400);
    }

    for (const recipeIngredient of recipe.ingredients) {
      const currentRequirement = requirementMap.get(recipeIngredient.ingredientId);
      const nextQuantity = roundQuantity(
        (currentRequirement?.quantity || 0) + decimalToNumber(recipeIngredient.quantity) * orderItem.quantity
      );

      requirementMap.set(recipeIngredient.ingredientId, {
        ingredientId: recipeIngredient.ingredientId,
        ingredient: recipeIngredient.ingredient,
        quantity: nextQuantity
      });
    }
  }

  if (missingRecipeItems.length > 0) {
    throw new InventoryError("Some menu items in this order do not have recipes configured yet.", 409, {
      menuItems: [...new Set(missingRecipeItems)]
    });
  }

  return [...requirementMap.values()];
}

async function consumeInventoryForOrder(client, order) {
  if (order.inventoryConsumedAt) {
    return {
      applied: false,
      inventoryConsumedAt: order.inventoryConsumedAt,
      movements: []
    };
  }

  const requirements = await buildOrderIngredientRequirements(client, order);
  if (requirements.length === 0) {
    return {
      applied: false,
      inventoryConsumedAt: null,
      movements: []
    };
  }

  const ingredientIds = requirements.map((requirement) => requirement.ingredientId);
  const ingredients = await client.ingredient.findMany({
    where: {
      restaurantId: order.restaurantId,
      id: {
        in: ingredientIds
      }
    },
    include: {
      stock: true
    }
  });
  const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

  const shortages = requirements
    .map((requirement) => {
      const ingredient = ingredientMap.get(requirement.ingredientId);
      const currentStock = roundQuantity(decimalToNumber(ingredient?.stock?.currentStock));

      return {
        ingredientId: requirement.ingredientId,
        ingredientName: requirement.ingredient.name,
        unit: requirement.ingredient.unit,
        requiredQuantity: requirement.quantity,
        currentStock,
        shortageQuantity: roundQuantity(requirement.quantity - currentStock)
      };
    })
    .filter((entry) => entry.currentStock + EPSILON < entry.requiredQuantity);

  if (shortages.length > 0) {
    throw new InventoryError("Insufficient stock to move this order into PREPARING.", 409, {
      shortages
    });
  }

  const inventoryConsumedAt = new Date();
  const movements = [];

  for (const requirement of requirements) {
    const movement = await applyStockMovement(client, order.restaurantId, {
      ingredientId: requirement.ingredientId,
      type: "ORDER_CONSUMPTION",
      quantity: -requirement.quantity,
      referenceType: "ORDER",
      referenceId: order.id,
      note: `Consumed by order ${order.orderCode}`
    });

    movements.push(movement);
  }

  return {
    applied: true,
    inventoryConsumedAt,
    movements
  };
}

async function runSerializableTransaction(prismaClient, callback, maxRetries = 3) {
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

  throw new InventoryError("Transaction failed after retrying.", 409);
}

module.exports = {
  InventoryError,
  applyStockMovement,
  buildOrderIngredientRequirements,
  consumeInventoryForOrder,
  createIngredient,
  createManualStockMovement,
  createPurchaseOrder,
  createSupplier,
  deleteRecipeForMenuItem,
  approveRecipeForMenuItem,
  createIngredientRequest,
  getIngredientMovementHistory,
  getInventoryConsumptionReport,
  getInventoryDashboard,
  getLowStockAlerts,
  getRecipeForMenuItem,
  listIngredientsWithStock,
  listIngredientRequests,
  listMenuItemsWithRecipes,
  listPurchaseOrders,
  listStockMovements,
  listSuppliers,
  mapIngredient,
  mapIngredientRequest,
  mapPurchaseOrder,
  mapRecipe,
  mapStockMovement,
  normalizeEmployeeRole,
  normalizeIngredientRequestStatus,
  receivePurchaseOrder,
  runSerializableTransaction,
  updateIngredientRequestStatus,
  updateIngredient,
  upsertRecipeForMenuItem
};
