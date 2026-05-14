const express = require("express");
const prisma = require("../../db");
const { authenticate, requireRoles } = require("../../middleware/auth");

const router = express.Router();

const ORDER_STATUSES = new Set([
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "READY",
  "COMPLETED",
  "CANCELLED"
]);

const ORDER_TYPES = new Set(["DELIVERY", "PICKUP"]);
const PREMIUM_PLAN_CODES = new Set(["PREMIUM", "PRO", "PAID"]);

function normalizeText(value) {
  const text = String(value || "").trim();
  return text || null;
}

function parsePrice(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function parseQuantity(value) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    return null;
  }
  return quantity;
}

function parseStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  return ORDER_STATUSES.has(status) ? status : null;
}

function parseOrderType(value) {
  const orderType = String(value || "DELIVERY").trim().toUpperCase();
  return ORDER_TYPES.has(orderType) ? orderType : null;
}

function parseSortOrder(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : 0;
}

function hasPremiumOnlineAccess(restaurant) {
  const subscription = restaurant?.subscription;
  const planCode = String(subscription?.plan?.code || "").trim().toUpperCase();
  return subscription?.status === "ACTIVE" && PREMIUM_PLAN_CODES.has(planCode);
}

function isPublicOnlineRestaurant(restaurant) {
  return (
    Boolean(restaurant?.isOpen) &&
    Boolean(restaurant?.onlineOrderingEnabled) &&
    hasPremiumOnlineAccess(restaurant)
  );
}

function mapRestaurant(restaurant) {
  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    description: restaurant.description,
    logoUrl: restaurant.logoUrl,
    address: restaurant.address,
    city: restaurant.city,
    district: restaurant.district,
    isOpen: restaurant.isOpen,
    onlineOrderingEnabled: restaurant.onlineOrderingEnabled,
    deliveryEnabled: restaurant.deliveryEnabled,
    pickupEnabled: restaurant.pickupEnabled,
    minOrderAmount: restaurant.minOrderAmount == null ? 0 : Number(restaurant.minOrderAmount),
    deliveryFee: restaurant.deliveryFee == null ? 0 : Number(restaurant.deliveryFee),
    onlineOrderingAvailable: isPublicOnlineRestaurant(restaurant),
    createdAt: restaurant.createdAt
  };
}

function mapCategory(category) {
  return {
    id: category.id,
    restaurantId: category.restaurantId,
    name: category.name,
    sortOrder: category.sortOrder
  };
}

function mapProduct(product) {
  return {
    id: product.id,
    restaurantId: product.restaurantId,
    categoryId: product.categoryId,
    category: product.category ? mapCategory(product.category) : null,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    imageUrl: product.imageUrl,
    isAvailable: product.isAvailable,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

function mapOrder(order) {
  return {
    id: order.id,
    userId: order.userId,
    restaurantId: order.restaurantId,
    restaurant: order.restaurant ? mapRestaurant(order.restaurant) : null,
    status: order.status,
    orderType: order.orderType,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    note: order.note,
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.deliveryFee),
    total: Number(order.total),
    items: (order.items || []).map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productName: item.productName,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      totalPrice: Number(item.totalPrice),
      note: item.note
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

function mapProfile(profile, user) {
  return {
    id: profile?.id || null,
    userId: user.id,
    fullName: profile?.fullName || user.fullName || "",
    phone: profile?.phone || user.phone || "",
    address: profile?.address || "",
    city: profile?.city || "",
    district: profile?.district || ""
  };
}

function mapOwnerSettings(restaurant) {
  return {
    restaurant: mapRestaurant(restaurant),
    plan: restaurant.subscription?.plan
      ? {
          id: restaurant.subscription.plan.id,
          code: restaurant.subscription.plan.code,
          displayName: restaurant.subscription.plan.displayName,
          monthlyPrice: restaurant.subscription.plan.monthlyPrice
        }
      : null,
    subscriptionStatus: restaurant.subscription?.status || null,
    premiumEnabled: hasPremiumOnlineAccess(restaurant)
  };
}

async function getOwnerRestaurant(authUserId, authRestaurantId) {
  if (!authRestaurantId) {
    const error = new Error("Owner has no restaurant assigned.");
    error.status = 400;
    throw error;
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: {
      id: authRestaurantId,
      users: {
        some: {
          id: authUserId,
          systemRole: "OWNER"
        }
      }
    },
    include: {
      subscription: {
        include: {
          plan: true
        }
      }
    }
  });

  if (!restaurant) {
    const error = new Error("Restaurant not found.");
    error.status = 404;
    throw error;
  }

  return restaurant;
}

async function getPublicRestaurantBySlug(slug) {
  const restaurant = await prisma.restaurant.findFirst({
    where: { slug: String(slug || "").trim() },
    include: {
      subscription: {
        include: {
          plan: true
        }
      }
    }
  });

  if (!restaurant || !isPublicOnlineRestaurant(restaurant)) {
    return null;
  }

  return restaurant;
}

router.get("/restaurants", async (req, res, next) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: {
        isOpen: true,
        onlineOrderingEnabled: true
      },
      include: {
        subscription: {
          include: {
            plan: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    const eligible = restaurants.filter(isPublicOnlineRestaurant);
    res.json({ restaurants: eligible.map(mapRestaurant) });
  } catch (error) {
    next(error);
  }
});

router.get("/restaurants/:slug", async (req, res, next) => {
  try {
    const restaurant = await getPublicRestaurantBySlug(req.params.slug);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }
    res.json({ restaurant: mapRestaurant(restaurant) });
  } catch (error) {
    next(error);
  }
});

router.get("/restaurants/:slug/menu", async (req, res, next) => {
  try {
    const restaurant = await getPublicRestaurantBySlug(req.params.slug);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    const [categories, products] = await Promise.all([
      prisma.restaurantCategory.findMany({
        where: { restaurantId: restaurant.id },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
      }),
      prisma.restaurantProduct.findMany({
        where: { restaurantId: restaurant.id },
        include: { category: true },
        orderBy: [{ isAvailable: "desc" }, { name: "asc" }]
      })
    ]);

    res.json({
      restaurant: mapRestaurant(restaurant),
      categories: categories.map(mapCategory),
      products: products.map(mapProduct)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/profile", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { profile: true }
    });
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ profile: mapProfile(user.profile, user) });
  } catch (error) {
    next(error);
  }
});

router.put("/profile", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { profile: true }
    });
    if (!user) return res.status(404).json({ message: "User not found." });

    const fullName = normalizeText(req.body?.fullName) || user.fullName;
    const phone = normalizeText(req.body?.phone);

    const profile = await prisma.$transaction(async (tx) => {
      const updated = await tx.userProfile.upsert({
        where: { userId: user.id },
        update: {
          fullName,
          phone,
          address: normalizeText(req.body?.address),
          city: normalizeText(req.body?.city),
          district: normalizeText(req.body?.district)
        },
        create: {
          userId: user.id,
          fullName,
          phone,
          address: normalizeText(req.body?.address),
          city: normalizeText(req.body?.city),
          district: normalizeText(req.body?.district)
        }
      });

      await tx.user.update({
        where: { id: user.id },
        data: { fullName, phone }
      });

      return updated;
    });

    res.json({ profile: mapProfile(profile, { ...user, fullName, phone }) });
  } catch (error) {
    next(error);
  }
});

router.post("/orders", authenticate, async (req, res, next) => {
  try {
    const restaurantId = normalizeText(req.body?.restaurantId);
    const orderType = parseOrderType(req.body?.orderType);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!restaurantId || !orderType || items.length === 0) {
      return res.status(400).json({ message: "restaurantId, orderType and items are required." });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        subscription: {
          include: {
            plan: true
          }
        }
      }
    });

    if (!restaurant || !isPublicOnlineRestaurant(restaurant)) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    if (orderType === "DELIVERY" && !restaurant.deliveryEnabled) {
      return res.status(400).json({ message: "Delivery is not available for this restaurant." });
    }
    if (orderType === "PICKUP" && !restaurant.pickupEnabled) {
      return res.status(400).json({ message: "Pickup is not available for this restaurant." });
    }

    const customerName = normalizeText(req.body?.customerName);
    const customerPhone = normalizeText(req.body?.customerPhone);
    const deliveryAddress = normalizeText(req.body?.deliveryAddress);

    if (!customerName) {
      return res.status(400).json({ message: "customerName is required." });
    }
    if (orderType === "DELIVERY" && !deliveryAddress) {
      return res.status(400).json({ message: "deliveryAddress is required for delivery orders." });
    }

    const normalizedItems = items.map((item) => ({
      productId: normalizeText(item?.productId),
      quantity: parseQuantity(item?.quantity),
      note: normalizeText(item?.note)
    }));
    if (normalizedItems.some((item) => !item.productId || !item.quantity)) {
      return res.status(400).json({ message: "Each item requires valid productId and quantity." });
    }

    const productIds = [...new Set(normalizedItems.map((item) => item.productId))];
    const products = await prisma.restaurantProduct.findMany({
      where: {
        restaurantId: restaurant.id,
        id: { in: productIds },
        isAvailable: true
      }
    });
    const productMap = new Map(products.map((product) => [product.id, product]));
    if (productMap.size !== productIds.length) {
      return res.status(409).json({ message: "One or more products are unavailable." });
    }

    let subtotal = 0;
    const orderItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId);
      const unitPrice = Number(product.price);
      const totalPrice = Math.round(unitPrice * item.quantity * 100) / 100;
      subtotal += totalPrice;
      return {
        productId: product.id,
        productName: product.name,
        unitPrice,
        quantity: item.quantity,
        totalPrice,
        note: item.note
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    const minimum = Number(restaurant.minOrderAmount || 0);
    if (subtotal < minimum) {
      return res.status(400).json({ message: `Minimum order amount is ${minimum}.` });
    }

    const deliveryFee = orderType === "DELIVERY" ? Number(restaurant.deliveryFee || 0) : 0;
    const total = Math.round((subtotal + deliveryFee) * 100) / 100;

    const order = await prisma.onlineOrder.create({
      data: {
        userId: req.auth.userId,
        restaurantId: restaurant.id,
        status: "PENDING",
        orderType,
        customerName,
        customerPhone,
        deliveryAddress: orderType === "DELIVERY" ? deliveryAddress : null,
        note: normalizeText(req.body?.note),
        subtotal,
        deliveryFee,
        total,
        items: { create: orderItems }
      },
      include: {
        restaurant: {
          include: {
            subscription: {
              include: { plan: true }
            }
          }
        },
        items: true
      }
    });

    res.status(201).json({ order: mapOrder(order) });
  } catch (error) {
    next(error);
  }
});

router.get("/orders/my", authenticate, async (req, res, next) => {
  try {
    const orders = await prisma.onlineOrder.findMany({
      where: { userId: req.auth.userId },
      include: {
        restaurant: {
          include: {
            subscription: {
              include: { plan: true }
            }
          }
        },
        items: true
      },
      orderBy: [{ createdAt: "desc" }]
    });
    res.json({ orders: orders.map(mapOrder) });
  } catch (error) {
    next(error);
  }
});

router.get("/orders/:id", authenticate, async (req, res, next) => {
  try {
    const order = await prisma.onlineOrder.findFirst({
      where: { id: req.params.id, userId: req.auth.userId },
      include: {
        restaurant: {
          include: {
            subscription: {
              include: { plan: true }
            }
          }
        },
        items: true
      }
    });
    if (!order) return res.status(404).json({ message: "Order not found." });
    res.json({ order: mapOrder(order) });
  } catch (error) {
    next(error);
  }
});

router.use("/owner", authenticate, requireRoles("OWNER"));

router.get("/owner/settings", async (req, res, next) => {
  try {
    const restaurant = await getOwnerRestaurant(req.auth.userId, req.auth.restaurantId);
    res.json(mapOwnerSettings(restaurant));
  } catch (error) {
    next(error);
  }
});

router.put("/owner/settings", async (req, res, next) => {
  try {
    const restaurant = await getOwnerRestaurant(req.auth.userId, req.auth.restaurantId);
    const premiumEnabled = hasPremiumOnlineAccess(restaurant);

    const nextOnlineOrderingEnabled =
      req.body?.onlineOrderingEnabled === undefined
        ? restaurant.onlineOrderingEnabled
        : Boolean(req.body.onlineOrderingEnabled);

    if (nextOnlineOrderingEnabled && !premiumEnabled) {
      return res.status(403).json({ message: "Online ordering requires premium plan" });
    }

    const minOrderAmount =
      req.body?.minOrderAmount === undefined
        ? Number(restaurant.minOrderAmount || 0)
        : parsePrice(req.body.minOrderAmount);
    const deliveryFee =
      req.body?.deliveryFee === undefined
        ? Number(restaurant.deliveryFee || 0)
        : parsePrice(req.body.deliveryFee);

    if (minOrderAmount == null || deliveryFee == null) {
      return res.status(400).json({ message: "minOrderAmount and deliveryFee must be valid numbers." });
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        onlineOrderingEnabled: nextOnlineOrderingEnabled,
        deliveryEnabled:
          req.body?.deliveryEnabled === undefined ? restaurant.deliveryEnabled : Boolean(req.body.deliveryEnabled),
        pickupEnabled:
          req.body?.pickupEnabled === undefined ? restaurant.pickupEnabled : Boolean(req.body.pickupEnabled),
        minOrderAmount,
        deliveryFee
      },
      include: {
        subscription: {
          include: {
            plan: true
          }
        }
      }
    });

    res.json(mapOwnerSettings(updated));
  } catch (error) {
    next(error);
  }
});

router.get("/owner/menu", async (req, res, next) => {
  try {
    const restaurant = await getOwnerRestaurant(req.auth.userId, req.auth.restaurantId);

    const [categories, products] = await Promise.all([
      prisma.restaurantCategory.findMany({
        where: { restaurantId: restaurant.id },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
      }),
      prisma.restaurantProduct.findMany({
        where: { restaurantId: restaurant.id },
        include: { category: true },
        orderBy: [{ createdAt: "desc" }]
      })
    ]);

    res.json({
      restaurant: mapRestaurant(restaurant),
      categories: categories.map(mapCategory),
      products: products.map(mapProduct)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/owner/categories", async (req, res, next) => {
  try {
    const restaurant = await getOwnerRestaurant(req.auth.userId, req.auth.restaurantId);
    const name = normalizeText(req.body?.name);
    if (!name) {
      return res.status(400).json({ message: "name is required." });
    }

    const category = await prisma.restaurantCategory.create({
      data: {
        restaurantId: restaurant.id,
        name,
        sortOrder: parseSortOrder(req.body?.sortOrder)
      }
    });
    res.status(201).json({ category: mapCategory(category) });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Category already exists in this restaurant." });
    }
    next(error);
  }
});

router.post("/owner/products", async (req, res, next) => {
  try {
    const restaurant = await getOwnerRestaurant(req.auth.userId, req.auth.restaurantId);
    const name = normalizeText(req.body?.name);
    const price = parsePrice(req.body?.price);
    const categoryId = normalizeText(req.body?.categoryId);

    if (!name || price == null) {
      return res.status(400).json({ message: "name and price are required." });
    }

    if (categoryId) {
      const category = await prisma.restaurantCategory.findFirst({
        where: { id: categoryId, restaurantId: restaurant.id },
        select: { id: true }
      });
      if (!category) {
        return res.status(400).json({ message: "Invalid categoryId for this restaurant." });
      }
    }

    const product = await prisma.restaurantProduct.create({
      data: {
        restaurantId: restaurant.id,
        categoryId,
        name,
        description: normalizeText(req.body?.description),
        price,
        imageUrl: normalizeText(req.body?.imageUrl),
        isAvailable: req.body?.isAvailable === undefined ? true : Boolean(req.body.isAvailable)
      },
      include: { category: true }
    });
    res.status(201).json({ product: mapProduct(product) });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Product already exists in this restaurant." });
    }
    next(error);
  }
});

router.put("/owner/products/:id", async (req, res, next) => {
  try {
    const restaurant = await getOwnerRestaurant(req.auth.userId, req.auth.restaurantId);
    const existing = await prisma.restaurantProduct.findFirst({
      where: { id: req.params.id, restaurantId: restaurant.id }
    });
    if (!existing) {
      return res.status(404).json({ message: "Product not found." });
    }

    const price = req.body?.price === undefined ? Number(existing.price) : parsePrice(req.body?.price);
    if (price == null) {
      return res.status(400).json({ message: "price must be a valid number." });
    }

    const categoryId =
      req.body?.categoryId === undefined ? existing.categoryId : normalizeText(req.body?.categoryId);

    if (categoryId) {
      const category = await prisma.restaurantCategory.findFirst({
        where: { id: categoryId, restaurantId: restaurant.id },
        select: { id: true }
      });
      if (!category) {
        return res.status(400).json({ message: "Invalid categoryId for this restaurant." });
      }
    }

    const updated = await prisma.restaurantProduct.update({
      where: { id: existing.id },
      data: {
        categoryId,
        name: normalizeText(req.body?.name) || existing.name,
        description: req.body?.description === undefined ? existing.description : normalizeText(req.body?.description),
        price,
        imageUrl: req.body?.imageUrl === undefined ? existing.imageUrl : normalizeText(req.body?.imageUrl),
        isAvailable: req.body?.isAvailable === undefined ? existing.isAvailable : Boolean(req.body?.isAvailable)
      },
      include: { category: true }
    });

    res.json({ product: mapProduct(updated) });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Product already exists in this restaurant." });
    }
    next(error);
  }
});

router.delete("/owner/products/:id", async (req, res, next) => {
  try {
    const restaurant = await getOwnerRestaurant(req.auth.userId, req.auth.restaurantId);
    const existing = await prisma.restaurantProduct.findFirst({
      where: { id: req.params.id, restaurantId: restaurant.id },
      select: { id: true }
    });
    if (!existing) {
      return res.status(404).json({ message: "Product not found." });
    }

    await prisma.restaurantProduct.delete({ where: { id: existing.id } });
    res.json({ id: existing.id });
  } catch (error) {
    next(error);
  }
});

router.get("/owner/orders", async (req, res, next) => {
  try {
    const restaurant = await getOwnerRestaurant(req.auth.userId, req.auth.restaurantId);
    const status = parseStatus(req.query?.status);
    if (req.query?.status && !status) {
      return res.status(400).json({ message: "Invalid status filter." });
    }

    const orders = await prisma.onlineOrder.findMany({
      where: {
        restaurantId: restaurant.id,
        ...(status ? { status } : {})
      },
      include: {
        restaurant: {
          include: {
            subscription: {
              include: { plan: true }
            }
          }
        },
        items: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    res.json({ orders: orders.map(mapOrder) });
  } catch (error) {
    next(error);
  }
});

router.put("/owner/orders/:id/status", async (req, res, next) => {
  try {
    const restaurant = await getOwnerRestaurant(req.auth.userId, req.auth.restaurantId);
    const status = parseStatus(req.body?.status);
    if (!status) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const order = await prisma.onlineOrder.findFirst({
      where: { id: req.params.id, restaurantId: restaurant.id },
      select: { id: true }
    });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const updated = await prisma.onlineOrder.update({
      where: { id: order.id },
      data: { status },
      include: {
        restaurant: {
          include: {
            subscription: {
              include: { plan: true }
            }
          }
        },
        items: true
      }
    });

    res.json({ order: mapOrder(updated) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
