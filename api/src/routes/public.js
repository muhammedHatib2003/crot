const express = require("express");
const prisma = require("../db");
const { ACTIVE_ORDER_STATUSES, mapOrder } = require("../utils/orders");
const { listMenuItems } = require("../utils/menu");
const { fetchTodayDisplayOrders } = require("../utils/displayOrders");
const { PosServiceError, createOrAppendTableOrder, createPickupOrder, orderInclude } = require("../services/pos.service");

const router = express.Router();

function mapPublicRestaurant(restaurant) {
  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    phone: restaurant.phone,
    logoUrl: restaurant.logoUrl
  };
}

function validatePublicRestaurant(restaurant, options = {}) {
  if (!restaurant) {
    const slugHint = options.slug ? ` (slug: ${options.slug})` : "";
    return { status: 404, message: `Restaurant not found${slugHint}.` };
  }

  if (!restaurant.subscription || restaurant.subscription.status !== "ACTIVE") {
    return { status: 403, message: "Ordering is not available for this restaurant yet." };
  }

  if (!restaurant.publicOrderingEnabled) {
    return { status: 403, message: "Public ordering is disabled for this restaurant." };
  }

  if (options.requirePickupEnabled && !restaurant.pickupEnabled) {
    return { status: 403, message: "Pickup ordering is disabled for this restaurant." };
  }

  return null;
}

async function getTableContext(tableId) {
  const table = await prisma.diningTable.findUnique({
    where: {
      id: tableId
    },
    include: {
      restaurant: {
        include: {
          subscription: true
        }
      }
    }
  });

  if (!table) {
    return { error: { status: 404, message: "Table not found." } };
  }

  const error = validatePublicRestaurant(table.restaurant);
  if (error) {
    return { error };
  }

  return { table };
}

async function getRestaurantContextBySlug(tenantSlug, options = {}) {
  const slug = String(tenantSlug || "").trim().toLowerCase();

  const restaurant = await prisma.restaurant.findFirst({
    where: {
      slug
    },
    include: {
      subscription: true
    }
  });

  const error = validatePublicRestaurant(restaurant, { ...options, slug });
  if (error) {
    return { error };
  }

  return { restaurant, slug };
}

async function getRestaurantContextForDisplay(tenantSlug) {
  const slug = String(tenantSlug || "").trim().toLowerCase();

  const restaurant = await prisma.restaurant.findFirst({
    where: {
      slug
    },
    include: {
      subscription: true
    }
  });

  if (!restaurant) {
    return { error: { status: 404, message: `Restaurant not found (slug: ${slug}).` } };
  }

  if (!restaurant.subscription || restaurant.subscription.status !== "ACTIVE") {
    return { error: { status: 403, message: "Order status screen is not available for this restaurant yet." } };
  }

  return { restaurant, slug };
}

function handleServiceError(res, error, next) {
  if (error instanceof PosServiceError) {
    return res.status(error.status).json({
      message: error.message,
      details: error.details || undefined
    });
  }

  return next(error);
}

router.get("/tables/:tableId/menu", async (req, res, next) => {
  try {
    const { table, error } = await getTableContext(req.params.tableId);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const [products, activeOrder] = await Promise.all([
      listMenuItems(prisma, table.restaurantId, {
        includeUnavailable: true
      }),
      prisma.order.findFirst({
        where: {
          tableId: table.id,
          status: {
            in: ACTIVE_ORDER_STATUSES
          }
        },
        include: orderInclude,
        orderBy: [{ createdAt: "desc" }]
      })
    ]);

    return res.json({
      restaurant: mapPublicRestaurant(table.restaurant),
      table: {
        id: table.id,
        name: table.name,
        seats: table.seats,
        status: table.status
      },
      items: products,
      products,
      activeOrder: mapOrder(activeOrder)
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

router.post("/tables/:tableId/orders", async (req, res, next) => {
  try {
    const { table, error } = await getTableContext(req.params.tableId);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const order = await createOrAppendTableOrder({
      restaurantId: table.restaurantId,
      tableId: table.id,
      items: req.body?.items,
      customerName: req.body?.customerName,
      source: "QR"
    });

    return res.status(201).json({
      message: "Order placed successfully.",
      order
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

async function handlePickupMenu(req, res, next) {
  try {
    const slug = req.params.tenantSlug || req.params.slug;
    const { restaurant, error } = await getRestaurantContextBySlug(slug, {
      requirePickupEnabled: true
    });

    if (error) {
      return res.status(error.status).json({ message: error.message, slug });
    }

    const products = await listMenuItems(prisma, restaurant.id, {
      includeUnavailable: true
    });

    const trackOrderId = String(req.query.orderId || req.query.trackOrder || "").trim();
    let activeOrder = null;

    if (trackOrderId) {
      const trackedOrder = await prisma.order.findFirst({
        where: {
          publicId: trackOrderId,
          restaurantId: restaurant.id,
          orderType: "PICKUP"
        },
        include: orderInclude
      });
      activeOrder = mapOrder(trackedOrder);
    }

    return res.json({
      restaurant: mapPublicRestaurant(restaurant),
      fulfillment: {
        type: "PICKUP"
      },
      items: products,
      products,
      activeOrder
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function handlePickupCreateOrder(req, res, next) {
  try {
    const slug = req.params.tenantSlug || req.params.slug;
    const { restaurant, error } = await getRestaurantContextBySlug(slug, {
      requirePickupEnabled: true
    });

    if (error) {
      return res.status(error.status).json({ message: error.message, slug });
    }

    const order = await createPickupOrder({
      restaurantId: restaurant.id,
      items: req.body?.items,
      customerName: req.body?.customerName,
      customerPhone: req.body?.customerPhone,
      notes: req.body?.notes,
      source: "PICKUP"
    });

    return res.status(201).json({
      message: "Pickup order created successfully.",
      order
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function handlePickupGetOrder(req, res, next) {
  try {
    const slug = req.params.tenantSlug || req.params.slug;
    const { restaurant, error } = await getRestaurantContextBySlug(slug, {
      requirePickupEnabled: true
    });

    if (error) {
      return res.status(error.status).json({ message: error.message, slug });
    }

    const order = await prisma.order.findFirst({
      where: {
        publicId: req.params.orderId,
        restaurantId: restaurant.id,
        orderType: "PICKUP"
      },
      include: orderInclude
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    return res.json({
      restaurant: mapPublicRestaurant(restaurant),
      order: mapOrder(order)
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

router.get("/tenants/:tenantSlug/menu", handlePickupMenu);
router.get("/restaurants/:slug/menu", handlePickupMenu);

router.post("/tenants/:tenantSlug/orders", handlePickupCreateOrder);
router.post("/restaurants/:slug/orders", handlePickupCreateOrder);

router.get("/tenants/:tenantSlug/orders/:orderId", handlePickupGetOrder);
router.get("/restaurants/:slug/orders/:orderId", handlePickupGetOrder);

async function handleDisplayOrders(req, res, next) {
  try {
    const slug = req.params.tenantSlug || req.params.slug;
    const { restaurant, error } = await getRestaurantContextForDisplay(slug);

    if (error) {
      return res.status(error.status).json({ message: error.message, slug });
    }

    const groups = await fetchTodayDisplayOrders(prisma, restaurant.id);

    return res.json({
      restaurant: mapPublicRestaurant(restaurant),
      groups,
      refreshedAt: new Date().toISOString()
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

router.get("/tenants/:tenantSlug/display-orders", handleDisplayOrders);
router.get("/restaurants/:slug/display-orders", handleDisplayOrders);

router.get("/orders/:orderId", async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        publicId: req.params.orderId
      },
      include: {
        ...orderInclude,
        restaurant: {
          include: {
            subscription: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const error = validatePublicRestaurant(order.restaurant);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    return res.json({
      restaurant: mapPublicRestaurant(order.restaurant),
      order: mapOrder(order)
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
});

module.exports = router;
