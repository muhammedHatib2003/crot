const express = require("express");
const prisma = require("../db");
const { authenticate, requireRoles } = require("../middleware/auth");
const { ensureUniqueRestaurantSlug } = require("../utils/slugs");
const {
  canTransitionOnlineOrder,
  mapCategory,
  mapOnlineOrder,
  mapOpeningHour,
  mapProduct,
  mapRestaurantBase,
  normalizeOptionalText,
  roundCurrency
} = require("../utils/onlineOrder");
const { normalizeDayOfWeek, parseTimeMinutes, isRestaurantOpenNow } = require("../utils/restaurantHours");
const { parseLatitude, parseLongitude } = require("../utils/geo");

const router = express.Router();

function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data
  });
}

function sendError(res, message, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    message
  });
}

function normalizeText(value) {
  return String(value || "").trim();
}

function parseNonNegativeNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return roundCurrency(numeric);
}

function parsePositiveInteger(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    return null;
  }

  return numeric;
}

function parseBoolean(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

async function getOwnerRestaurant(req) {
  const restaurantId = normalizeText(req.auth?.restaurantId);
  if (!restaurantId) {
    return null;
  }

  return prisma.restaurant.findFirst({
    where: {
      id: restaurantId,
      users: {
        some: {
          id: req.auth.userId,
          systemRole: "OWNER"
        }
      }
    },
    include: {
      openingHours: {
        orderBy: [{ dayOfWeek: "asc" }]
      }
    }
  });
}

function mapOwnerRestaurantSettings(restaurant) {
  return {
    ...mapRestaurantBase(restaurant, {
      isCurrentlyOpen: isRestaurantOpenNow(restaurant)
    }),
    openingHours: restaurant.openingHours.map(mapOpeningHour)
  };
}

function validateOpeningHours(rawOpeningHours) {
  if (!Array.isArray(rawOpeningHours)) {
    return { error: "openingHours must be an array." };
  }

  const seenDays = new Set();
  const normalized = [];

  for (const rawSlot of rawOpeningHours) {
    const dayOfWeek = normalizeDayOfWeek(rawSlot?.dayOfWeek);
    if (dayOfWeek === null) {
      return { error: "Each openingHours item must include dayOfWeek between 0 and 6." };
    }

    if (seenDays.has(dayOfWeek)) {
      return { error: "openingHours cannot include duplicate dayOfWeek values." };
    }

    seenDays.add(dayOfWeek);

    const isClosed = parseBoolean(rawSlot?.isClosed, false);
    if (isClosed === null) {
      return { error: "isClosed must be boolean." };
    }

    const openTime = normalizeText(rawSlot?.openTime || "09:00");
    const closeTime = normalizeText(rawSlot?.closeTime || "22:00");

    if (parseTimeMinutes(openTime) === null || parseTimeMinutes(closeTime) === null) {
      return { error: "openTime and closeTime must be in HH:mm format." };
    }

    normalized.push({
      dayOfWeek,
      openTime,
      closeTime,
      isClosed
    });
  }

  return { openingHours: normalized };
}

router.use(authenticate, requireRoles("OWNER"));

router.get("/restaurant/settings", async (req, res) => {
  try {
    const restaurant = await getOwnerRestaurant(req);
    if (!restaurant) {
      return sendError(res, "Restaurant not found.", 404);
    }

    return sendSuccess(res, {
      restaurant: mapOwnerRestaurantSettings(restaurant)
    });
  } catch (error) {
    console.error("GET /api/owner/restaurant/settings failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.put("/restaurant/settings", async (req, res) => {
  try {
    const restaurant = await getOwnerRestaurant(req);
    if (!restaurant) {
      return sendError(res, "Restaurant not found.", 404);
    }

    const body = req.body || {};
    const data = {};

    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      const name = normalizeOptionalText(body.name);
      if (!name) {
        return sendError(res, "name cannot be empty.", 400);
      }
      data.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(body, "slug")) {
      const slug = normalizeOptionalText(body.slug);
      if (!slug) {
        return sendError(res, "slug cannot be empty.", 400);
      }
      data.slug = await ensureUniqueRestaurantSlug(prisma, slug, restaurant.id);
    }

    if (Object.prototype.hasOwnProperty.call(body, "description")) {
      data.description = normalizeOptionalText(body.description);
    }

    if (Object.prototype.hasOwnProperty.call(body, "cuisineType")) {
      data.cuisineType = normalizeOptionalText(body.cuisineType);
    }

    if (Object.prototype.hasOwnProperty.call(body, "logoUrl")) {
      data.logoUrl = normalizeOptionalText(body.logoUrl);
    }

    if (Object.prototype.hasOwnProperty.call(body, "coverImageUrl")) {
      data.coverImageUrl = normalizeOptionalText(body.coverImageUrl);
    }

    if (Object.prototype.hasOwnProperty.call(body, "phone")) {
      data.phone = normalizeOptionalText(body.phone);
    }

    if (Object.prototype.hasOwnProperty.call(body, "addressText")) {
      const addressText = normalizeOptionalText(body.addressText);
      data.addressText = addressText;
      data.address = addressText;
    }

    if (Object.prototype.hasOwnProperty.call(body, "city")) {
      data.city = normalizeOptionalText(body.city);
    }

    if (Object.prototype.hasOwnProperty.call(body, "district")) {
      data.district = normalizeOptionalText(body.district);
    }

    if (Object.prototype.hasOwnProperty.call(body, "latitude")) {
      const latitude = parseLatitude(body.latitude);
      if (body.latitude !== null && body.latitude !== "" && latitude === null) {
        return sendError(res, "latitude must be between -90 and 90.", 400);
      }
      data.latitude = latitude;
    }

    if (Object.prototype.hasOwnProperty.call(body, "longitude")) {
      const longitude = parseLongitude(body.longitude);
      if (body.longitude !== null && body.longitude !== "" && longitude === null) {
        return sendError(res, "longitude must be between -180 and 180.", 400);
      }
      data.longitude = longitude;
    }

    if (Object.prototype.hasOwnProperty.call(body, "isOnlineOrderingEnabled")) {
      const isOnlineOrderingEnabled = parseBoolean(body.isOnlineOrderingEnabled);
      if (isOnlineOrderingEnabled === null) {
        return sendError(res, "isOnlineOrderingEnabled must be boolean.", 400);
      }
      data.isOnlineOrderingEnabled = isOnlineOrderingEnabled;
      data.onlineOrderingEnabled = isOnlineOrderingEnabled;
    }

    if (Object.prototype.hasOwnProperty.call(body, "isOpen")) {
      const isOpen = parseBoolean(body.isOpen);
      if (isOpen === null) {
        return sendError(res, "isOpen must be boolean.", 400);
      }
      data.isOpen = isOpen;
    }

    if (Object.prototype.hasOwnProperty.call(body, "minimumOrderAmount")) {
      const minimumOrderAmount = parseNonNegativeNumber(body.minimumOrderAmount);
      if (minimumOrderAmount === null) {
        return sendError(res, "minimumOrderAmount must be a non-negative number.", 400);
      }
      data.minimumOrderAmount = minimumOrderAmount;
      data.minOrderAmount = minimumOrderAmount;
    }

    if (Object.prototype.hasOwnProperty.call(body, "baseDeliveryFee")) {
      const baseDeliveryFee = parseNonNegativeNumber(body.baseDeliveryFee);
      if (baseDeliveryFee === null) {
        return sendError(res, "baseDeliveryFee must be a non-negative number.", 400);
      }
      data.baseDeliveryFee = baseDeliveryFee;
      data.deliveryFee = baseDeliveryFee;
    }

    if (Object.prototype.hasOwnProperty.call(body, "feePerKm")) {
      const feePerKm = parseNonNegativeNumber(body.feePerKm);
      if (feePerKm === null) {
        return sendError(res, "feePerKm must be a non-negative number.", 400);
      }
      data.feePerKm = feePerKm;
    }

    if (Object.prototype.hasOwnProperty.call(body, "deliveryFee")) {
      const deliveryFee = parseNonNegativeNumber(body.deliveryFee);
      if (deliveryFee === null) {
        return sendError(res, "deliveryFee must be a non-negative number.", 400);
      }
      data.deliveryFee = deliveryFee;
      if (!Object.prototype.hasOwnProperty.call(body, "baseDeliveryFee")) {
        data.baseDeliveryFee = deliveryFee;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "freeDeliveryThreshold")) {
      if (body.freeDeliveryThreshold === null || body.freeDeliveryThreshold === "") {
        data.freeDeliveryThreshold = null;
      } else {
        const freeDeliveryThreshold = parseNonNegativeNumber(body.freeDeliveryThreshold);
        if (freeDeliveryThreshold === null) {
          return sendError(res, "freeDeliveryThreshold must be a non-negative number.", 400);
        }
        data.freeDeliveryThreshold = freeDeliveryThreshold;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "estimatedDeliveryMinutes")) {
      const estimatedDeliveryMinutes = parsePositiveInteger(body.estimatedDeliveryMinutes);
      if (estimatedDeliveryMinutes === null) {
        return sendError(res, "estimatedDeliveryMinutes must be a non-negative whole number.", 400);
      }
      data.estimatedDeliveryMinutes = estimatedDeliveryMinutes;
    }

    if (Object.prototype.hasOwnProperty.call(body, "deliveryRadiusKm")) {
      const deliveryRadiusKm = parseNonNegativeNumber(body.deliveryRadiusKm);
      if (deliveryRadiusKm === null) {
        return sendError(res, "deliveryRadiusKm must be a non-negative number.", 400);
      }
      data.deliveryRadiusKm = deliveryRadiusKm;
    }

    if (Object.prototype.hasOwnProperty.call(body, "pickupEnabled")) {
      const pickupEnabled = parseBoolean(body.pickupEnabled);
      if (pickupEnabled === null) {
        return sendError(res, "pickupEnabled must be boolean.", 400);
      }
      data.pickupEnabled = pickupEnabled;
    }

    if (Object.prototype.hasOwnProperty.call(body, "deliveryEnabled")) {
      const deliveryEnabled = parseBoolean(body.deliveryEnabled);
      if (deliveryEnabled === null) {
        return sendError(res, "deliveryEnabled must be boolean.", 400);
      }
      data.deliveryEnabled = deliveryEnabled;
    }

    const hasOpeningHours = Object.prototype.hasOwnProperty.call(body, "openingHours");
    const { openingHours, error: openingHoursError } = hasOpeningHours
      ? validateOpeningHours(body.openingHours)
      : { openingHours: [] };

    if (openingHoursError) {
      return sendError(res, openingHoursError, 400);
    }

    const updatedRestaurant = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.restaurant.update({
          where: {
            id: restaurant.id
          },
          data
        });
      }

      if (hasOpeningHours) {
        await tx.restaurantOpeningHour.deleteMany({
          where: {
            restaurantId: restaurant.id
          }
        });

        if (openingHours.length > 0) {
          await tx.restaurantOpeningHour.createMany({
            data: openingHours.map((slot) => ({
              restaurantId: restaurant.id,
              dayOfWeek: slot.dayOfWeek,
              openTime: slot.openTime,
              closeTime: slot.closeTime,
              isClosed: slot.isClosed
            }))
          });
        }
      }

      return tx.restaurant.findUnique({
        where: {
          id: restaurant.id
        },
        include: {
          openingHours: {
            orderBy: [{ dayOfWeek: "asc" }]
          }
        }
      });
    });

    return sendSuccess(res, {
      restaurant: mapOwnerRestaurantSettings(updatedRestaurant)
    });
  } catch (error) {
    console.error("PUT /api/owner/restaurant/settings failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.get("/menu/categories", async (req, res) => {
  try {
    const restaurant = await getOwnerRestaurant(req);
    if (!restaurant) {
      return sendError(res, "Restaurant not found.", 404);
    }

    const categories = await prisma.category.findMany({
      where: {
        restaurantId: restaurant.id
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    return sendSuccess(res, {
      categories: categories.map(mapCategory)
    });
  } catch (error) {
    console.error("GET /api/owner/menu/categories failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.post("/menu/categories", async (req, res) => {
  try {
    const restaurant = await getOwnerRestaurant(req);
    if (!restaurant) {
      return sendError(res, "Restaurant not found.", 404);
    }

    const name = normalizeOptionalText(req.body?.name);
    if (!name) {
      return sendError(res, "name is required.", 400);
    }

    const sortOrder = parsePositiveInteger(req.body?.sortOrder, 0);
    if (sortOrder === null) {
      return sendError(res, "sortOrder must be a non-negative whole number.", 400);
    }

    const isActive = parseBoolean(req.body?.isActive, true);
    if (isActive === null) {
      return sendError(res, "isActive must be boolean.", 400);
    }

    const category = await prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name,
        sortOrder,
        isActive
      }
    });

    return sendSuccess(
      res,
      {
        category: mapCategory(category)
      },
      201
    );
  } catch (error) {
    if (error?.code === "P2002") {
      return sendError(res, "Category name already exists.", 409);
    }

    console.error("POST /api/owner/menu/categories failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.put("/menu/categories/:id", async (req, res) => {
  try {
    const restaurant = await getOwnerRestaurant(req);
    if (!restaurant) {
      return sendError(res, "Restaurant not found.", 404);
    }

    const categoryId = normalizeText(req.params.id);
    const existingCategory = await prisma.category.findFirst({
      where: {
        id: categoryId,
        restaurantId: restaurant.id
      }
    });

    if (!existingCategory) {
      return sendError(res, "Category not found.", 404);
    }

    const data = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "name")) {
      const name = normalizeOptionalText(req.body?.name);
      if (!name) {
        return sendError(res, "name cannot be empty.", 400);
      }
      data.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "sortOrder")) {
      const sortOrder = parsePositiveInteger(req.body?.sortOrder);
      if (sortOrder === null) {
        return sendError(res, "sortOrder must be a non-negative whole number.", 400);
      }
      data.sortOrder = sortOrder;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "isActive")) {
      const isActive = parseBoolean(req.body?.isActive);
      if (isActive === null) {
        return sendError(res, "isActive must be boolean.", 400);
      }
      data.isActive = isActive;
    }

    if (Object.keys(data).length === 0) {
      return sendError(res, "No valid fields provided.", 400);
    }

    const category = await prisma.category.update({
      where: {
        id: existingCategory.id
      },
      data
    });

    return sendSuccess(res, {
      category: mapCategory(category)
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return sendError(res, "Category name already exists.", 409);
    }

    console.error("PUT /api/owner/menu/categories/:id failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.delete("/menu/categories/:id", async (req, res) => {
  try {
    const restaurant = await getOwnerRestaurant(req);
    if (!restaurant) {
      return sendError(res, "Restaurant not found.", 404);
    }

    const categoryId = normalizeText(req.params.id);
    const existingCategory = await prisma.category.findFirst({
      where: {
        id: categoryId,
        restaurantId: restaurant.id
      }
    });

    if (!existingCategory) {
      return sendError(res, "Category not found.", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: {
          restaurantId: restaurant.id,
          categoryId: existingCategory.id
        },
        data: {
          categoryId: null
        }
      });

      await tx.category.delete({
        where: {
          id: existingCategory.id
        }
      });
    });

    return sendSuccess(res, {
      id: existingCategory.id
    });
  } catch (error) {
    console.error("DELETE /api/owner/menu/categories/:id failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.get("/menu/products", async (req, res) => {
  try {
    const restaurant = await getOwnerRestaurant(req);
    if (!restaurant) {
      return sendError(res, "Restaurant not found.", 404);
    }

    const products = await prisma.product.findMany({
      where: {
        restaurantId: restaurant.id
      },
      include: {
        category: true
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    return sendSuccess(res, {
      products: products.map((product) => ({
        ...mapProduct(product),
        category: product.category ? mapCategory(product.category) : null
      }))
    });
  } catch (error) {
    console.error("GET /api/owner/menu/products failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.post("/menu/products", async (req, res) => {
  try {
    const restaurant = await getOwnerRestaurant(req);
    if (!restaurant) {
      return sendError(res, "Restaurant not found.", 404);
    }

    const name = normalizeOptionalText(req.body?.name);
    if (!name) {
      return sendError(res, "name is required.", 400);
    }

    const price = parseNonNegativeNumber(req.body?.price);
    if (price === null) {
      return sendError(res, "price must be a non-negative number.", 400);
    }

    const categoryId = normalizeOptionalText(req.body?.categoryId);
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          restaurantId: restaurant.id
        }
      });

      if (!category) {
        return sendError(res, "Invalid categoryId.", 400);
      }
    }

    const preparationMinutes = parsePositiveInteger(req.body?.preparationMinutes, 20);
    if (preparationMinutes === null) {
      return sendError(res, "preparationMinutes must be a non-negative whole number.", 400);
    }

    const sortOrder = parsePositiveInteger(req.body?.sortOrder, 0);
    if (sortOrder === null) {
      return sendError(res, "sortOrder must be a non-negative whole number.", 400);
    }

    const isAvailable = parseBoolean(req.body?.isAvailable, true);
    if (isAvailable === null) {
      return sendError(res, "isAvailable must be boolean.", 400);
    }

    const product = await prisma.product.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: categoryId || null,
        name,
        description: normalizeOptionalText(req.body?.description),
        price,
        imageUrl: normalizeOptionalText(req.body?.imageUrl),
        isAvailable,
        preparationMinutes,
        sortOrder
      },
      include: {
        category: true
      }
    });

    return sendSuccess(
      res,
      {
        product: {
          ...mapProduct(product),
          category: product.category ? mapCategory(product.category) : null
        }
      },
      201
    );
  } catch (error) {
    if (error?.code === "P2002") {
      return sendError(res, "Product name already exists.", 409);
    }

    console.error("POST /api/owner/menu/products failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.put("/menu/products/:id", async (req, res) => {
  try {
    const restaurant = await getOwnerRestaurant(req);
    if (!restaurant) {
      return sendError(res, "Restaurant not found.", 404);
    }

    const productId = normalizeText(req.params.id);
    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        restaurantId: restaurant.id
      }
    });

    if (!existingProduct) {
      return sendError(res, "Product not found.", 404);
    }

    const data = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "name")) {
      const name = normalizeOptionalText(req.body?.name);
      if (!name) {
        return sendError(res, "name cannot be empty.", 400);
      }
      data.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "description")) {
      data.description = normalizeOptionalText(req.body?.description);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "price")) {
      const price = parseNonNegativeNumber(req.body?.price);
      if (price === null) {
        return sendError(res, "price must be a non-negative number.", 400);
      }
      data.price = price;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "imageUrl")) {
      data.imageUrl = normalizeOptionalText(req.body?.imageUrl);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "isAvailable")) {
      const isAvailable = parseBoolean(req.body?.isAvailable);
      if (isAvailable === null) {
        return sendError(res, "isAvailable must be boolean.", 400);
      }
      data.isAvailable = isAvailable;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "preparationMinutes")) {
      const preparationMinutes = parsePositiveInteger(req.body?.preparationMinutes);
      if (preparationMinutes === null) {
        return sendError(res, "preparationMinutes must be a non-negative whole number.", 400);
      }
      data.preparationMinutes = preparationMinutes;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "sortOrder")) {
      const sortOrder = parsePositiveInteger(req.body?.sortOrder);
      if (sortOrder === null) {
        return sendError(res, "sortOrder must be a non-negative whole number.", 400);
      }
      data.sortOrder = sortOrder;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "categoryId")) {
      const categoryId = normalizeOptionalText(req.body?.categoryId);
      if (categoryId) {
        const category = await prisma.category.findFirst({
          where: {
            id: categoryId,
            restaurantId: restaurant.id
          }
        });

        if (!category) {
          return sendError(res, "Invalid categoryId.", 400);
        }
        data.categoryId = category.id;
      } else {
        data.categoryId = null;
      }
    }

    if (Object.keys(data).length === 0) {
      return sendError(res, "No valid fields provided.", 400);
    }

    const product = await prisma.product.update({
      where: {
        id: existingProduct.id
      },
      data,
      include: {
        category: true
      }
    });

    return sendSuccess(res, {
      product: {
        ...mapProduct(product),
        category: product.category ? mapCategory(product.category) : null
      }
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return sendError(res, "Product name already exists.", 409);
    }

    console.error("PUT /api/owner/menu/products/:id failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.delete("/menu/products/:id", async (req, res) => {
  try {
    const restaurant = await getOwnerRestaurant(req);
    if (!restaurant) {
      return sendError(res, "Restaurant not found.", 404);
    }

    const productId = normalizeText(req.params.id);
    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        restaurantId: restaurant.id
      }
    });

    if (!existingProduct) {
      return sendError(res, "Product not found.", 404);
    }

    await prisma.product.delete({
      where: {
        id: existingProduct.id
      }
    });

    return sendSuccess(res, {
      id: existingProduct.id
    });
  } catch (error) {
    console.error("DELETE /api/owner/menu/products/:id failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.get("/orders", async (req, res) => {
  try {
    const restaurant = await getOwnerRestaurant(req);
    if (!restaurant) {
      return sendError(res, "Restaurant not found.", 404);
    }

    const normalizedStatus = normalizeText(req.query.status).toUpperCase();

    const orders = await prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        source: "ONLINE",
        ...(normalizedStatus ? { status: normalizedStatus } : {})
      },
      include: {
        items: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return sendSuccess(res, {
      orders: orders.map(mapOnlineOrder)
    });
  } catch (error) {
    console.error("GET /api/owner/orders failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const restaurant = await getOwnerRestaurant(req);
    if (!restaurant) {
      return sendError(res, "Restaurant not found.", 404);
    }

    const orderId = normalizeText(req.params.id);

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        restaurantId: restaurant.id,
        source: "ONLINE"
      },
      include: {
        items: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true
          }
        }
      }
    });

    if (!order) {
      return sendError(res, "Order not found.", 404);
    }

    return sendSuccess(res, {
      order: mapOnlineOrder(order)
    });
  } catch (error) {
    console.error("GET /api/owner/orders/:id failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.patch("/orders/:id/status", async (req, res) => {
  try {
    const restaurant = await getOwnerRestaurant(req);
    if (!restaurant) {
      return sendError(res, "Restaurant not found.", 404);
    }

    const orderId = normalizeText(req.params.id);
    const nextStatus = normalizeText(req.body?.status).toUpperCase();

    if (!nextStatus) {
      return sendError(res, "status is required.", 400);
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        restaurantId: restaurant.id,
        source: "ONLINE"
      },
      include: {
        items: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true
          }
        }
      }
    });

    if (!order) {
      return sendError(res, "Order not found.", 404);
    }

    if (!canTransitionOnlineOrder(order.status, nextStatus)) {
      return sendError(res, "Invalid order status transition.", 400);
    }

    const now = new Date();
    const data = {
      status: nextStatus
    };

    if (nextStatus === "ACCEPTED" && !order.acceptedAt) {
      data.acceptedAt = now;
    }

    if (nextStatus === "PREPARING" && !order.preparingAt) {
      data.preparingAt = now;
    }

    if (nextStatus === "READY" && !order.readyAt) {
      data.readyAt = now;
    }

    if (nextStatus === "COMPLETED" && !order.completedAt) {
      data.completedAt = now;
    }

    if (nextStatus === "REJECTED") {
      data.cancelledAt = now;
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: order.id
      },
      data,
      include: {
        items: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true
          }
        }
      }
    });

    return sendSuccess(res, {
      order: mapOnlineOrder(updatedOrder)
    });
  } catch (error) {
    console.error("PATCH /api/owner/orders/:id/status failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

module.exports = router;
