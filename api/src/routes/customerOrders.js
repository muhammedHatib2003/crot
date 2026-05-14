const express = require("express");
const prisma = require("../db");
const { authenticate } = require("../middleware/auth");
const { createOnlineCustomerOrder, PosServiceError } = require("../services/pos.service");
const { MENU_ITEM_AVAILABILITY_INCLUDE, getMenuItemAvailability } = require("../utils/menu");
const { mapOrder } = require("../utils/orders");

const router = express.Router();
const ALLOWED_DELIVERY_TYPES = new Set(["DELIVERY", "PICKUP"]);

router.use(authenticate);

async function resolveAuthenticatedCustomerId(req) {
  const tokenCustomerId = String(req.auth?.customerId || req.auth?.userId || "").trim();
  if (!tokenCustomerId) {
    return null;
  }

  const customer = await prisma.customer.findUnique({
    where: {
      id: tokenCustomerId
    },
    select: {
      id: true
    }
  });

  return customer?.id || null;
}

function normalizeText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({
    success: false,
    message
  });
}

function normalizeOrderItems(rawItems) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (items.length === 0) {
    return { error: "items cannot be empty." };
  }

  const normalizedItems = items.map((item) => {
    const productId = String(item?.productId || "").trim();
    const quantity = Number(item?.quantity);

    if (!productId) {
      return { error: "Each item must include productId." };
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return { error: "Each item quantity must be at least 1." };
    }

    return {
      productId,
      quantity
    };
  });

  const firstError = normalizedItems.find((item) => item.error);
  if (firstError) {
    return { error: firstError.error };
  }

  return { items: normalizedItems };
}

router.post("/", async (req, res) => {
  try {
    const customerId = await resolveAuthenticatedCustomerId(req);
    if (!customerId) {
      return sendError(res, 401, "Customer login required.");
    }

    const restaurantId = String(req.body?.restaurantId || "").trim();
    if (!restaurantId) {
      return sendError(res, 400, "restaurantId is required.");
    }

    const { items, error: itemsError } = normalizeOrderItems(req.body?.items);
    if (itemsError) {
      return sendError(res, 400, itemsError);
    }

    const deliveryType = String(req.body?.deliveryType || "DELIVERY")
      .trim()
      .toUpperCase();
    if (!ALLOWED_DELIVERY_TYPES.has(deliveryType)) {
      return sendError(res, 400, "deliveryType must be DELIVERY or PICKUP.");
    }

    const customerName = normalizeText(req.body?.customerName);
    const customerPhone = normalizeText(req.body?.customerPhone);
    const customerAddress = normalizeText(req.body?.customerAddress);
    const note = normalizeText(req.body?.note);

    if (!customerName) {
      return sendError(res, 400, "customerName is required.");
    }
    if (!customerPhone) {
      return sendError(res, 400, "customerPhone is required.");
    }
    if (deliveryType === "DELIVERY" && !customerAddress) {
      return sendError(res, 400, "customerAddress is required for DELIVERY orders.");
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: {
        id: restaurantId
      },
      select: {
        id: true,
        isOpen: true,
        onlineOrderingEnabled: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        minOrderAmount: true,
        deliveryFee: true
      }
    });

    if (!restaurant) {
      return sendError(res, 404, "Restaurant not found.");
    }

    if (!restaurant.isOpen) {
      return sendError(res, 400, "Restaurant is currently closed.");
    }

    if (!restaurant.onlineOrderingEnabled) {
      return sendError(res, 400, "Online ordering is disabled for this restaurant.");
    }

    if (deliveryType === "DELIVERY" && !restaurant.deliveryEnabled) {
      return sendError(res, 400, "Delivery is disabled for this restaurant.");
    }

    if (deliveryType === "PICKUP" && !restaurant.pickupEnabled) {
      return sendError(res, 400, "Pickup is disabled for this restaurant.");
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await prisma.menuItem.findMany({
      where: {
        restaurantId,
        id: {
          in: productIds
        }
      },
      include: MENU_ITEM_AVAILABILITY_INCLUDE
    });

    if (products.length !== productIds.length) {
      return sendError(res, 400, "One or more products do not belong to this restaurant.");
    }

    const productsById = new Map(products.map((product) => [product.id, product]));
    let subtotalCents = 0;

    for (const item of items) {
      const product = productsById.get(item.productId);
      if (!product) {
        return sendError(res, 400, "Invalid product in items.");
      }
      if (!product.isAvailable) {
        return sendError(res, 400, `${product.name} is not active.`);
      }

      const availability = getMenuItemAvailability(product);
      if (!availability.isOrderable) {
        return sendError(res, 400, `${product.name} is not orderable right now.`);
      }

      if (item.quantity > availability.availableStock) {
        return sendError(res, 400, `${product.name} does not have enough stock.`);
      }

      subtotalCents += product.priceCents * item.quantity;
    }

    const minOrderCents = Math.round(Number(restaurant.minOrderAmount || 0) * 100);
    if (subtotalCents < minOrderCents) {
      return sendError(
        res,
        400,
        `Minimum order amount is ${Number(restaurant.minOrderAmount || 0).toFixed(2)}.`
      );
    }

    const deliveryFeeCents =
      deliveryType === "DELIVERY" ? Math.round(Number(restaurant.deliveryFee || 0) * 100) : 0;

    const order = await createOnlineCustomerOrder({
      restaurantId,
      orderType: deliveryType,
      source: "ONLINE",
      customerUserId: customerId,
      customerName,
      customerPhone,
      customerAddress: deliveryType === "DELIVERY" ? customerAddress : null,
      notes: note,
      deliveryFeeCents,
      items
    });

    return res.status(201).json({
      success: true,
      data: {
        order
      }
    });
  } catch (error) {
    if (error instanceof PosServiceError) {
      return sendError(res, error.status || 400, error.message || "Order could not be created.");
    }

    console.error("POST /api/customer/orders failed:", error);
    return sendError(res, 500, "Internal server error.");
  }
});

router.get("/my", async (req, res) => {
  try {
    const customerId = await resolveAuthenticatedCustomerId(req);
    if (!customerId) {
      return sendError(res, 401, "Customer login required.");
    }

    const orders = await prisma.order.findMany({
      where: {
        customerUserId: customerId,
        source: "ONLINE"
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
        table: true,
        items: true,
        payment: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return res.status(200).json({
      success: true,
      data: {
        orders: orders.map(mapOrder)
      }
    });
  } catch (error) {
    console.error("GET /api/customer/orders/my failed:", error);
    return sendError(res, 500, "Internal server error.");
  }
});

module.exports = router;
