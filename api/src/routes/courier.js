const express = require("express");
const prisma = require("../db");
const { authenticateCourier } = require("../middleware/auth");
const { mapOrder } = require("../utils/orders");
const { PosServiceError, updateOrderStatus } = require("../services/pos.service");
const {
  acceptOrder,
  CourierDispatchError,
  listNearbyOffers,
  orderInclude,
  updateCourierLocation
} = require("../modules/courier-dispatch/dispatch.service");

const router = express.Router();
const MY_QUEUE_STATUSES = ["READY", "SERVED"];
const ALLOWED_NEXT_STATUSES = new Set(["SERVED", "COMPLETED"]);

router.use(authenticateCourier);

function handleServiceError(res, error, next) {
  if (error instanceof PosServiceError) {
    return res.status(error.status).json({
      message: error.message,
      details: error.details || undefined
    });
  }

  if (error instanceof CourierDispatchError) {
    return res.status(error.status).json({ message: error.message });
  }

  return next(error);
}

async function findAssignedDeliveryOrder(courierAccountId, orderId) {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      orderType: "DELIVERY",
      assignedCourierAccountId: courierAccountId
    },
    include: orderInclude
  });
}

router.post("/location", async (req, res, next) => {
  try {
    const body = await updateCourierLocation(req.courierAccount.id, req.body?.latitude, req.body?.longitude);
    return res.json(body);
  } catch (err) {
    return handleServiceError(res, err, next);
  }
});

router.get("/offers", async (req, res, next) => {
  try {
    const payload = await listNearbyOffers({
      courierAccountId: req.courierAccount.id
    });

    return res.json(payload);
  } catch (err) {
    return handleServiceError(res, err, next);
  }
});

router.post("/offers/:orderId/accept", async (req, res, next) => {
  try {
    const orderId = String(req.params.orderId || "").trim();
    const order = await acceptOrder({
      orderId,
      courierAccountId: req.courierAccount.id
    });

    return res.json({ order });
  } catch (err) {
    return handleServiceError(res, err, next);
  }
});

router.get("/orders", async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        orderType: "DELIVERY",
        assignedCourierAccountId: req.courierAccount.id,
        status: {
          in: MY_QUEUE_STATUSES
        }
      },
      include: orderInclude,
      orderBy: [{ readyAt: "asc" }, { createdAt: "asc" }]
    });

    return res.json({
      orders: orders.map(mapOrder)
    });
  } catch (err) {
    return handleServiceError(res, err, next);
  }
});

router.patch("/orders/:orderId/status", async (req, res, next) => {
  try {
    const orderId = String(req.params.orderId || "").trim();
    const status = String(req.body?.status || "").trim().toUpperCase();

    if (!ALLOWED_NEXT_STATUSES.has(status)) {
      return res.status(400).json({ message: "status must be SERVED or COMPLETED." });
    }

    const existingOrder = await findAssignedDeliveryOrder(req.courierAccount.id, orderId);
    if (!existingOrder) {
      return res.status(404).json({ message: "Delivery order not found or not assigned to you." });
    }

    const order = await updateOrderStatus({
      restaurantId: existingOrder.restaurantId,
      orderId,
      status,
      actorRole: "courier"
    });

    return res.json({
      order
    });
  } catch (err) {
    return handleServiceError(res, err, next);
  }
});

module.exports = router;
