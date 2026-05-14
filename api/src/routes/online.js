const express = require("express");
const prisma = require("../db");
const { authenticate } = require("../middleware/auth");
const { haversineDistanceKm, parseLatitude, parseLongitude } = require("../utils/geo");
const { isRestaurantOpenNow } = require("../utils/restaurantHours");
const { listMenuItems, MENU_ITEM_AVAILABILITY_INCLUDE, getMenuItemAvailability } = require("../utils/menu");
const {
  mapOnlineOrder,
  mapOpeningHour,
  mapRestaurantBase,
  normalizeOptionalText,
  roundCurrency,
  toBoolean
} = require("../utils/onlineOrder");

const router = express.Router();
const ALLOWED_ORDER_TYPES = new Set(["DELIVERY", "PICKUP"]);
const ALLOWED_PAYMENT_METHODS = new Set(["CASH", "CARD_ON_DELIVERY", "ONLINE"]);
const SORT_BY_VALUES = new Set(["nearest", "fastest", "minimum_order", "delivery_fee", "rating"]);

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

function normalizeQueryText(value) {
  return String(value || "").trim();
}

function normalizeOrderItems(rawItems) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (items.length === 0) {
    return { error: "items cannot be empty." };
  }

  const normalizedItems = [];
  for (const item of items) {
    const productId = normalizeQueryText(item?.productId);
    const quantity = Number(item?.quantity);

    if (!productId) {
      return { error: "Each item must include productId." };
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 30) {
      return { error: "Each item quantity must be a whole number between 1 and 30." };
    }

    normalizedItems.push({
      productId,
      quantity,
      note: normalizeOptionalText(item?.note)
    });
  }

  return { items: normalizedItems };
}

function normalizeRestaurantOnlineEnabled(restaurant) {
  return Boolean(restaurant?.isOnlineOrderingEnabled ?? restaurant?.onlineOrderingEnabled);
}

function resolveMinimumOrderAmount(restaurant) {
  const minimum =
    restaurant?.minimumOrderAmount != null ? Number(restaurant.minimumOrderAmount) : Number(restaurant?.minOrderAmount || 0);

  return roundCurrency(minimum);
}

function resolveBaseDeliveryFee(restaurant) {
  if (restaurant?.baseDeliveryFee != null) {
    return roundCurrency(restaurant.baseDeliveryFee);
  }
  return roundCurrency(restaurant?.deliveryFee || 0);
}

function resolveFeePerKm(restaurant) {
  return roundCurrency(restaurant?.feePerKm || 0);
}

function calculateDeliveryFeeForDistance(restaurant, distanceKm, subtotal = null) {
  const baseDeliveryFee = resolveBaseDeliveryFee(restaurant);
  const feePerKm = resolveFeePerKm(restaurant);
  const distance = Number(distanceKm || 0);
  const rawDeliveryFee = baseDeliveryFee + distance * feePerKm;
  let deliveryFee = roundCurrency(rawDeliveryFee);

  const threshold = restaurant?.freeDeliveryThreshold == null ? null : Number(restaurant.freeDeliveryThreshold);
  if (threshold != null && subtotal != null && Number(subtotal) >= threshold) {
    deliveryFee = 0;
  }

  return deliveryFee;
}

function parseSortBy(rawSortBy) {
  const sortBy = normalizeQueryText(rawSortBy).toLowerCase();
  if (!sortBy) {
    return "nearest";
  }
  if (!SORT_BY_VALUES.has(sortBy)) {
    return "nearest";
  }
  return sortBy;
}

function mapOnlineMenuItem(item) {
  return {
    id: item.id,
    restaurantId: item.restaurantId,
    categoryId: null,
    name: item.name,
    description: item.description || null,
    price: roundCurrency(item.price),
    imageUrl: item.photoUrl || null,
    isAvailable: Boolean(item.isAvailable),
    isOrderable: item.isOrderable !== false,
    preparationMinutes: 20,
    sortOrder: 0
  };
}

function resolveCustomerIdentity(req) {
  return normalizeQueryText(req.auth?.customerId || req.auth?.userId);
}

async function getAuthenticatedCustomer(req, res) {
  const customerId = resolveCustomerIdentity(req);
  if (!customerId) {
    sendError(res, "Customer login required.", 401);
    return null;
  }

  const customer = await prisma.customer.findUnique({
    where: {
      id: customerId
    }
  });

  if (!customer) {
    sendError(res, "Customer login required.", 401);
    return null;
  }

  return customer;
}

async function findRestaurantByIdOrSlug(restaurantId, restaurantSlug) {
  const normalizedRestaurantId = normalizeQueryText(restaurantId);
  const normalizedRestaurantSlug = normalizeQueryText(restaurantSlug);

  if (!normalizedRestaurantId && !normalizedRestaurantSlug) {
    return null;
  }

  return prisma.restaurant.findFirst({
    where: {
      ...(normalizedRestaurantId ? { id: normalizedRestaurantId } : { slug: normalizedRestaurantSlug })
    },
    include: {
      openingHours: {
        orderBy: [{ dayOfWeek: "asc" }]
      }
    }
  });
}

function buildRestaurantWhere(reqQuery) {
  const city = normalizeQueryText(reqQuery.city);
  const district = normalizeQueryText(reqQuery.district);
  const search = normalizeQueryText(reqQuery.search);

  const where = {
    OR: [{ isOnlineOrderingEnabled: true }, { onlineOrderingEnabled: true }]
  };

  if (city) {
    where.city = {
      equals: city,
      mode: "insensitive"
    };
  }

  if (district) {
    where.district = {
      equals: district,
      mode: "insensitive"
    };
  }

  if (search) {
    where.AND = [
      {
        OR: [
          {
            name: {
              contains: search,
              mode: "insensitive"
            }
          },
          {
            description: {
              contains: search,
              mode: "insensitive"
            }
          }
        ]
      }
    ];
  }

  return where;
}

router.get("/restaurants", async (req, res) => {
  try {
    const onlyOpen = toBoolean(req.query.onlyOpen, false);
    const onlyDelivery = toBoolean(req.query.delivery, false);
    const onlyPickup = toBoolean(req.query.pickup, false);

    const latitude = parseLatitude(req.query.lat);
    const longitude = parseLongitude(req.query.lng);
    const hasCoordinates = latitude !== null && longitude !== null;
    const sortBy = parseSortBy(req.query.sortBy);

    const restaurants = await prisma.restaurant.findMany({
      where: buildRestaurantWhere(req.query),
      include: {
        openingHours: {
          orderBy: [{ dayOfWeek: "asc" }]
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    const data = [];

    for (const restaurant of restaurants) {
      if (!normalizeRestaurantOnlineEnabled(restaurant)) {
        continue;
      }

      const isCurrentlyOpen = isRestaurantOpenNow(restaurant);
      if (onlyOpen && !isCurrentlyOpen) {
        continue;
      }

      if (onlyDelivery && !restaurant.deliveryEnabled) {
        continue;
      }

      if (onlyPickup && !restaurant.pickupEnabled) {
        continue;
      }

      let distanceKm = null;
      let inDeliveryZone = null;
      let calculatedDeliveryFee = resolveBaseDeliveryFee(restaurant);
      if (hasCoordinates) {
        if (restaurant.latitude == null || restaurant.longitude == null) {
          inDeliveryZone = false;
        } else {
          const rawDistance = haversineDistanceKm(latitude, longitude, Number(restaurant.latitude), Number(restaurant.longitude));
          if (rawDistance != null) {
            distanceKm = roundCurrency(rawDistance);
            inDeliveryZone = distanceKm <= Number(restaurant.deliveryRadiusKm || 0);
            calculatedDeliveryFee = calculateDeliveryFeeForDistance(restaurant, distanceKm);
          } else {
            inDeliveryZone = false;
          }
        }
      }

      data.push(
        mapRestaurantBase(restaurant, {
          isCurrentlyOpen,
          distanceKm,
          inDeliveryZone,
          calculatedDeliveryFee
        })
      );
    }

    data.sort((first, second) => {
      if (sortBy === "fastest") {
        return Number(first.estimatedDeliveryMinutes || 9999) - Number(second.estimatedDeliveryMinutes || 9999);
      }

      if (sortBy === "minimum_order") {
        return Number(first.minimumOrderAmount || 0) - Number(second.minimumOrderAmount || 0);
      }

      if (sortBy === "delivery_fee") {
        return Number(first.deliveryFee || 0) - Number(second.deliveryFee || 0);
      }

      if (sortBy === "rating") {
        return Number(second.ratingAverage || 0) - Number(first.ratingAverage || 0);
      }

      if (first.distanceKm == null && second.distanceKm == null) {
        return 0;
      }
      if (first.distanceKm == null) {
        return 1;
      }
      if (second.distanceKm == null) {
        return -1;
      }
      return first.distanceKm - second.distanceKm;
    });

    return sendSuccess(res, {
      restaurants: data
    });
  } catch (error) {
    console.error("GET /api/online/restaurants failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.get("/restaurants/:slug", async (req, res) => {
  try {
    const slug = normalizeQueryText(req.params.slug).toLowerCase();
    if (!slug) {
      return sendError(res, "Restaurant slug is required.", 400);
    }

    const restaurant = await prisma.restaurant.findFirst({
      where: {
        slug
      },
      include: {
        openingHours: {
          orderBy: [{ dayOfWeek: "asc" }]
        }
      }
    });

    if (!restaurant || !normalizeRestaurantOnlineEnabled(restaurant)) {
      return sendError(res, "Restaurant not found.", 404);
    }

    const latitude = parseLatitude(req.query.lat);
    const longitude = parseLongitude(req.query.lng);
    const hasCoordinates = latitude !== null && longitude !== null;

    let distanceKm = null;
    let inDeliveryZone = null;
    if (hasCoordinates && restaurant.latitude != null && restaurant.longitude != null) {
      const rawDistance = haversineDistanceKm(latitude, longitude, Number(restaurant.latitude), Number(restaurant.longitude));
      distanceKm = rawDistance == null ? null : roundCurrency(rawDistance);
      if (distanceKm != null) {
        inDeliveryZone = distanceKm <= Number(restaurant.deliveryRadiusKm || 0);
      }
    }

    return sendSuccess(res, {
      restaurant: {
        ...mapRestaurantBase(restaurant, {
          isCurrentlyOpen: isRestaurantOpenNow(restaurant),
          distanceKm,
          inDeliveryZone,
          calculatedDeliveryFee: distanceKm == null ? resolveBaseDeliveryFee(restaurant) : calculateDeliveryFeeForDistance(restaurant, distanceKm)
        }),
        openingHours: restaurant.openingHours.map(mapOpeningHour),
        inDeliveryZone
      }
    });
  } catch (error) {
    console.error("GET /api/online/restaurants/:slug failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.get("/restaurants/:slug/menu", async (req, res) => {
  try {
    const slug = normalizeQueryText(req.params.slug).toLowerCase();
    if (!slug) {
      return sendError(res, "Restaurant slug is required.", 400);
    }

    const restaurant = await prisma.restaurant.findFirst({
      where: {
        slug
      },
      include: {
        openingHours: {
          orderBy: [{ dayOfWeek: "asc" }]
        }
      }
    });

    if (!restaurant || !normalizeRestaurantOnlineEnabled(restaurant)) {
      return sendError(res, "Restaurant not found.", 404);
    }

    const menuItems = await listMenuItems(prisma, restaurant.id, {
      includeUnavailable: true
    });

    const categoriesMap = new Map();
    for (const item of menuItems) {
      const categoryName = String(item.category || "General").trim() || "General";
      if (!categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, {
          id: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          restaurantId: restaurant.id,
          name: categoryName,
          sortOrder: 0,
          isActive: true,
          products: []
        });
      }
      categoriesMap.get(categoryName).products.push(mapOnlineMenuItem(item));
    }

    const categories = [...categoriesMap.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));

    return sendSuccess(res, {
      restaurant: {
        ...mapRestaurantBase(restaurant, {
          isCurrentlyOpen: isRestaurantOpenNow(restaurant),
          calculatedDeliveryFee: resolveBaseDeliveryFee(restaurant)
        }),
        openingHours: restaurant.openingHours.map(mapOpeningHour)
      },
      categories
    });
  } catch (error) {
    console.error("GET /api/online/restaurants/:slug/menu failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.post("/orders", authenticate, async (req, res) => {
  try {
    const customer = await getAuthenticatedCustomer(req, res);
    if (!customer) {
      return;
    }

    const { items, error: itemsError } = normalizeOrderItems(req.body?.items);
    if (itemsError) {
      return sendError(res, itemsError, 400);
    }

    const orderType = normalizeQueryText(req.body?.orderType || "DELIVERY").toUpperCase();
    if (!ALLOWED_ORDER_TYPES.has(orderType)) {
      return sendError(res, "orderType must be DELIVERY or PICKUP.", 400);
    }

    const paymentMethod = normalizeQueryText(req.body?.paymentMethod || "CASH").toUpperCase();
    if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
      return sendError(res, "paymentMethod must be CASH, CARD_ON_DELIVERY, or ONLINE.", 400);
    }

    const restaurant = await findRestaurantByIdOrSlug(req.body?.restaurantId, req.body?.restaurantSlug || req.body?.slug);
    if (!restaurant || !normalizeRestaurantOnlineEnabled(restaurant)) {
      return sendError(res, "Restaurant not found.", 404);
    }

    if (!isRestaurantOpenNow(restaurant)) {
      return sendError(res, "Restaurant is currently closed.", 400);
    }

    if (orderType === "DELIVERY" && !restaurant.deliveryEnabled) {
      return sendError(res, "Delivery is disabled for this restaurant.", 400);
    }

    if (orderType === "PICKUP" && !restaurant.pickupEnabled) {
      return sendError(res, "Pickup is disabled for this restaurant.", 400);
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await prisma.menuItem.findMany({
      where: {
        restaurantId: restaurant.id,
        id: {
          in: productIds
        }
      },
      include: MENU_ITEM_AVAILABILITY_INCLUDE
    });

    if (products.length !== productIds.length) {
      return sendError(res, "One or more products are invalid for this restaurant.", 400);
    }

    const productsById = new Map(products.map((product) => [product.id, product]));

    let subtotal = 0;
    for (const item of items) {
      const product = productsById.get(item.productId);
      if (!product) {
        return sendError(res, "Invalid product in items.", 400);
      }

      if (!product.isAvailable) {
        return sendError(res, `${product.name} is not available.`, 400);
      }

      const availability = getMenuItemAvailability(product);
      if (!availability.isOrderable) {
        return sendError(res, `${product.name} is not orderable right now.`, 400);
      }

      if (item.quantity > availability.availableStock) {
        return sendError(res, `${product.name} does not have enough stock.`, 400);
      }

      subtotal += roundCurrency(Number(product.priceCents || 0) / 100 * item.quantity);
    }

    subtotal = roundCurrency(subtotal);
    const minimumOrderAmount = resolveMinimumOrderAmount(restaurant);
    if (subtotal < minimumOrderAmount) {
      return sendError(res, `Minimum order amount is ${minimumOrderAmount.toFixed(2)}.`, 400);
    }

    let resolvedAddressText = null;
    let resolvedLatitude = null;
    let resolvedLongitude = null;
    let resolvedReceiverName = null;
    let resolvedPhone = null;

    if (orderType === "DELIVERY") {
      const addressId = normalizeQueryText(req.body?.addressId);
      if (addressId) {
        const savedAddress = await prisma.userAddress.findFirst({
          where: {
            id: addressId,
            userId: customer.id
          }
        });

        if (!savedAddress) {
          return sendError(res, "Address not found.", 404);
        }

        resolvedAddressText = savedAddress.addressText;
        resolvedLatitude = savedAddress.latitude == null ? null : Number(savedAddress.latitude);
        resolvedLongitude = savedAddress.longitude == null ? null : Number(savedAddress.longitude);
        resolvedReceiverName = savedAddress.receiverName;
        resolvedPhone = savedAddress.phone;
      } else {
        const manualAddress = req.body?.manualAddress || req.body?.address || {};
        resolvedAddressText = normalizeOptionalText(manualAddress.addressText || req.body?.deliveryAddressText);
        resolvedLatitude = parseLatitude(manualAddress.latitude || req.body?.deliveryLatitude);
        resolvedLongitude = parseLongitude(manualAddress.longitude || req.body?.deliveryLongitude);
        resolvedReceiverName = normalizeOptionalText(manualAddress.receiverName);
        resolvedPhone = normalizeOptionalText(manualAddress.phone);
      }

      if (!resolvedAddressText) {
        return sendError(res, "Delivery address is required.", 400);
      }

      if (resolvedLatitude === null || resolvedLongitude === null) {
        return sendError(res, "Delivery address latitude and longitude are required.", 400);
      }

      if (restaurant.latitude == null || restaurant.longitude == null) {
        return sendError(res, "Restaurant location is not configured.", 400);
      }
    }

    let distanceKm = null;
    let deliveryFee = 0;

    if (orderType === "DELIVERY") {
      const rawDistance = haversineDistanceKm(
        Number(restaurant.latitude),
        Number(restaurant.longitude),
        Number(resolvedLatitude),
        Number(resolvedLongitude)
      );

      if (rawDistance == null) {
        return sendError(res, "Distance could not be calculated.", 400);
      }

      distanceKm = roundCurrency(rawDistance);
      if (distanceKm > Number(restaurant.deliveryRadiusKm || 0)) {
        return sendError(res, "Selected address is outside delivery area.", 400);
      }

      deliveryFee = calculateDeliveryFeeForDistance(restaurant, distanceKm, subtotal);
    }

    const total = roundCurrency(subtotal + deliveryFee);

    const requiresOnlinePayment = paymentMethod === "ONLINE";
    const initialOrderStatus = requiresOnlinePayment ? "PENDING_PAYMENT" : "PENDING";

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          restaurantId: restaurant.id,
          orderType,
          source: "ONLINE",
          status: initialOrderStatus,
          paymentStatus: "PENDING",
          paymentMethod,
          customerUserId: customer.id,
          customerId: customer.id,
          customerName: normalizeOptionalText(req.body?.customerName) || resolvedReceiverName || customer.fullName,
          customerPhone: normalizeOptionalText(req.body?.customerPhone) || resolvedPhone || customer.phone,
          customerAddress: resolvedAddressText,
          deliveryAddressText: resolvedAddressText,
          deliveryLatitude: resolvedLatitude,
          deliveryLongitude: resolvedLongitude,
          distanceKm,
          note: normalizeOptionalText(req.body?.note),
          notes: normalizeOptionalText(req.body?.note),
          subtotal,
          deliveryFee,
          total,
          subtotalCents: Math.round(subtotal * 100),
          deliveryFeeCents: Math.round(deliveryFee * 100),
          totalCents: Math.round(total * 100),
          items: {
            create: items.map((item) => {
              const product = productsById.get(item.productId);
              const unitPrice = roundCurrency(Number(product.priceCents || 0) / 100);
              return {
                restaurantId: restaurant.id,
                menuItemId: product.id,
                nameSnapshot: product.name,
                productNameSnapshot: product.name,
                priceCents: Math.round(unitPrice * 100),
                unitPriceSnapshot: unitPrice,
                quantity: item.quantity,
                totalPrice: roundCurrency(unitPrice * item.quantity),
                note: item.note,
                notes: item.note
              };
            })
          }
        },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true
            }
          },
          items: true
        }
      });

      return created;
    });

    return sendSuccess(
      res,
      {
        order: mapOnlineOrder(order)
      },
      201
    );
  } catch (error) {
    console.error("POST /api/online/orders failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

module.exports = router;
