const express = require("express");
const prisma = require("../../db");
const { authenticate, requireRoles } = require("../../middleware/auth");
const { PaymentError, startIyzicoCheckout, handleIyzicoCallback } = require("./payment.service");
const {
  SubscriptionPaymentError,
  startSubscriptionCheckout,
  handleSubscriptionCallback,
  getSubscriptionPaymentStatus
} = require("./subscription.service");

const router = express.Router();

function sendError(res, status, message, code) {
  return res.status(status).json({
    success: false,
    message,
    code: code || undefined
  });
}

async function resolveAuthenticatedCustomer(req, res) {
  const customerId = String(req.auth?.customerId || req.auth?.userId || "").trim();
  if (!customerId) {
    sendError(res, 401, "Online musteri girisi gerekli.", "AUTH_REQUIRED");
    return null;
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    sendError(res, 401, "Online musteri girisi gerekli.", "AUTH_REQUIRED");
    return null;
  }

  return customer;
}

router.post("/iyzico/checkout", authenticate, async (req, res) => {
  try {
    const customer = await resolveAuthenticatedCustomer(req, res);
    if (!customer) {
      return;
    }

    const orderId = String(req.body?.orderId || "").trim();
    if (!orderId) {
      return sendError(res, 400, "orderId gerekli.", "ORDER_ID_REQUIRED");
    }

    const result = await startIyzicoCheckout({ orderId, customer });

    return res.status(200).json({
      success: true,
      data: {
        paymentId: result.payment.id,
        token: result.token,
        conversationId: result.conversationId,
        paymentPageUrl: result.paymentPageUrl,
        checkoutFormContent: result.checkoutFormContent
      }
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return sendError(res, error.statusCode, error.message, error.code);
    }
    console.error("POST /api/payments/iyzico/checkout failed:", error);
    return sendError(res, 500, "Iyzico odeme baslatilamadi.", "INTERNAL_ERROR");
  }
});

router.post(
  "/iyzico/callback",
  express.urlencoded({ extended: true }),
  express.json(),
  async (req, res) => {
    try {
      const token = String(req.body?.token || req.query?.token || "").trim();
      const result = await handleIyzicoCallback({ token });
      return res.redirect(303, result.redirectUrl);
    } catch (error) {
      console.error("POST /api/payments/iyzico/callback failed:", error);
      return res.redirect(303, "/payment/result?status=failure&reason=server_error");
    }
  }
);

router.get("/iyzico/orders/:orderId", authenticate, async (req, res) => {
  try {
    const customer = await resolveAuthenticatedCustomer(req, res);
    if (!customer) {
      return;
    }

    const orderId = String(req.params.orderId || "").trim();
    if (!orderId) {
      return sendError(res, 400, "orderId gerekli.", "ORDER_ID_REQUIRED");
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId },
      include: { orderPayment: true }
    });

    if (!order) {
      return sendError(res, 404, "Siparis bulunamadi.", "ORDER_NOT_FOUND");
    }

    const owns =
      (order.customerId && order.customerId === customer.id) ||
      (order.customerUserId && order.customerUserId === customer.id);

    if (!owns) {
      return sendError(res, 403, "Bu siparis size ait degil.", "ORDER_NOT_OWNED");
    }

    return res.json({
      success: true,
      data: {
        orderId: order.id,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
        payment: order.orderPayment
          ? {
              status: order.orderPayment.status,
              provider: order.orderPayment.provider,
              price: order.orderPayment.price,
              currency: order.orderPayment.currency,
              iyzicoPaymentId: order.orderPayment.iyzicoPaymentId
            }
          : null
      }
    });
  } catch (error) {
    console.error("GET /api/payments/iyzico/orders/:orderId failed:", error);
    return sendError(res, 500, "Odeme durumu alinamadi.", "INTERNAL_ERROR");
  }
});

router.post(
  "/iyzico/subscription/checkout",
  authenticate,
  requireRoles("OWNER"),
  async (req, res) => {
    try {
      const planId = String(req.body?.planId || "").trim();
      const restaurantId = req.auth?.restaurantId;
      const ownerUserId = req.auth?.userId;

      const result = await startSubscriptionCheckout({
        ownerUserId,
        restaurantId,
        planId
      });

      return res.status(200).json({
        success: true,
        data: {
          conversationId: result.conversationId,
          token: result.token,
          paymentPageUrl: result.paymentPageUrl,
          checkoutFormContent: result.checkoutFormContent,
          plan: result.plan
        }
      });
    } catch (error) {
      if (error instanceof SubscriptionPaymentError) {
        return sendError(res, error.statusCode, error.message, error.code);
      }
      console.error("POST /api/payments/iyzico/subscription/checkout failed:", error);
      return sendError(res, 500, "Abonelik odemesi baslatilamadi.", "INTERNAL_ERROR");
    }
  }
);

router.post(
  "/iyzico/subscription/callback",
  express.urlencoded({ extended: true }),
  express.json(),
  async (req, res) => {
    try {
      const token = String(req.body?.token || req.query?.token || "").trim();
      const result = await handleSubscriptionCallback({ token });
      return res.redirect(303, result.redirectUrl);
    } catch (error) {
      console.error("POST /api/payments/iyzico/subscription/callback failed:", error);
      return res.redirect(303, "/payment/result?kind=subscription&status=failure&reason=server_error");
    }
  }
);

router.get(
  "/iyzico/subscription/status",
  authenticate,
  requireRoles("OWNER"),
  async (req, res) => {
    try {
      const restaurantId = req.auth?.restaurantId;
      const data = await getSubscriptionPaymentStatus({ restaurantId });
      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof SubscriptionPaymentError) {
        return sendError(res, error.statusCode, error.message, error.code);
      }
      console.error("GET /api/payments/iyzico/subscription/status failed:", error);
      return sendError(res, 500, "Abonelik durumu alinamadi.", "INTERNAL_ERROR");
    }
  }
);

module.exports = router;
