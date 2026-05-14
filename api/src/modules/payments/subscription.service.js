const prisma = require("../../db");
const config = require("../../config");
const iyzicoService = require("./iyzico.service");

const SUBSCRIPTION_CONVERSATION_PREFIX = "sub";

class SubscriptionPaymentError extends Error {
  constructor(message, statusCode = 400, code = "SUBSCRIPTION_PAYMENT_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function buildResultRedirectUrl(status, params = {}) {
  const url = new URL("/payment/result", config.clientUrl);
  url.searchParams.set("kind", "subscription");
  url.searchParams.set("status", status);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function buildSubscriptionCallbackUrl() {
  return `${String(config.apiUrl).replace(/\/$/, "")}/api/payments/iyzico/subscription/callback`;
}

function buildConversationId(restaurantId) {
  const stamp = Date.now().toString(36);
  return `${SUBSCRIPTION_CONVERSATION_PREFIX}-${restaurantId}-${stamp}`;
}

function parseConversationId(conversationId) {
  if (!conversationId || typeof conversationId !== "string") {
    return null;
  }
  const parts = conversationId.split("-");
  if (parts.length < 3 || parts[0] !== SUBSCRIPTION_CONVERSATION_PREFIX) {
    return null;
  }
  const stamp = parts[parts.length - 1];
  const restaurantId = parts.slice(1, -1).join("-");
  if (!restaurantId) {
    return null;
  }
  return { restaurantId, stamp };
}

async function startSubscriptionCheckout({ ownerUserId, restaurantId, planId }) {
  if (!ownerUserId) {
    throw new SubscriptionPaymentError("Yetkilendirme bilgisi eksik.", 401, "AUTH_REQUIRED");
  }
  if (!restaurantId) {
    throw new SubscriptionPaymentError("Restoran bulunamadi.", 400, "RESTAURANT_REQUIRED");
  }
  if (!planId) {
    throw new SubscriptionPaymentError("planId zorunludur.", 400, "PLAN_ID_REQUIRED");
  }

  const [owner, restaurant, plan] = await Promise.all([
    prisma.user.findUnique({ where: { id: ownerUserId } }),
    prisma.restaurant.findUnique({ where: { id: restaurantId } }),
    prisma.plan.findUnique({ where: { id: planId } })
  ]);

  if (!owner) {
    throw new SubscriptionPaymentError("Owner bulunamadi.", 404, "OWNER_NOT_FOUND");
  }
  if (!restaurant) {
    throw new SubscriptionPaymentError("Restoran bulunamadi.", 404, "RESTAURANT_NOT_FOUND");
  }
  if (!plan) {
    throw new SubscriptionPaymentError("Plan bulunamadi.", 404, "PLAN_NOT_FOUND");
  }
  if (!Number.isFinite(Number(plan.monthlyPrice)) || Number(plan.monthlyPrice) <= 0) {
    throw new SubscriptionPaymentError("Plan ucreti gecersiz.", 400, "PLAN_PRICE_INVALID");
  }

  const conversationId = buildConversationId(restaurantId);
  const callbackUrl = buildSubscriptionCallbackUrl();

  let initResponse;
  try {
    initResponse = await iyzicoService.initializeSubscriptionCheckoutForm({
      owner,
      restaurant,
      plan,
      callbackUrl,
      conversationId
    });
  } catch (error) {
    if (error.code === "IYZICO_CONFIG_MISSING") {
      throw new SubscriptionPaymentError(error.message, 503, error.code);
    }
    throw new SubscriptionPaymentError(
      error.message || "iyzico abonelik odemesi baslatilamadi.",
      502,
      error.code || "IYZICO_INITIALIZE_FAILED"
    );
  }

  await prisma.subscription.upsert({
    where: { restaurantId },
    create: {
      restaurantId,
      planId,
      status: "PENDING_PAYMENT"
    },
    update: {
      planId,
      status: "PENDING_PAYMENT"
    }
  });

  return {
    conversationId,
    token: initResponse.token,
    paymentPageUrl: initResponse.paymentPageUrl || null,
    checkoutFormContent: initResponse.checkoutFormContent || null,
    plan: {
      id: plan.id,
      code: plan.code,
      displayName: plan.displayName,
      monthlyPrice: plan.monthlyPrice
    }
  };
}

async function handleSubscriptionCallback({ token }) {
  if (!token) {
    return {
      redirectUrl: buildResultRedirectUrl("failure", { reason: "missing_token" })
    };
  }

  let retrieveResponse;
  try {
    retrieveResponse = await iyzicoService.retrieveCheckoutForm({ token });
  } catch (error) {
    return {
      redirectUrl: buildResultRedirectUrl("failure", { reason: "iyzico_retrieve_failed" })
    };
  }

  const parsed = parseConversationId(retrieveResponse.conversationId);
  if (!parsed) {
    return {
      redirectUrl: buildResultRedirectUrl("failure", { reason: "conversation_mismatch" })
    };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { restaurantId: parsed.restaurantId },
    include: { plan: true, restaurant: true }
  });

  if (!subscription || !subscription.plan) {
    return {
      redirectUrl: buildResultRedirectUrl("failure", { reason: "subscription_not_found" })
    };
  }

  const isSuccess =
    retrieveResponse.status === "success" &&
    String(retrieveResponse.paymentStatus || "").toUpperCase() === "SUCCESS";

  const expectedPrice = Number(subscription.plan.monthlyPrice);
  const paidPrice = Number(retrieveResponse.paidPrice || retrieveResponse.price || 0);
  const priceMatches = Number.isFinite(paidPrice) && Math.abs(paidPrice - expectedPrice) < 0.01;

  if (isSuccess && priceMatches) {
    await prisma.subscription.update({
      where: { restaurantId: parsed.restaurantId },
      data: {
        status: "ACTIVE",
        activatedAt: new Date()
      }
    });

    return {
      redirectUrl: buildResultRedirectUrl("success", {
        restaurantId: parsed.restaurantId,
        planCode: subscription.plan.code
      })
    };
  }

  await prisma.subscription.update({
    where: { restaurantId: parsed.restaurantId },
    data: {
      status: "PAYMENT_FAILED"
    }
  });

  return {
    redirectUrl: buildResultRedirectUrl("failure", {
      restaurantId: parsed.restaurantId,
      reason: retrieveResponse.errorCode || (priceMatches ? "payment_failed" : "price_mismatch")
    })
  };
}

async function getSubscriptionPaymentStatus({ restaurantId }) {
  if (!restaurantId) {
    throw new SubscriptionPaymentError("Restoran bulunamadi.", 400, "RESTAURANT_REQUIRED");
  }

  const subscription = await prisma.subscription.findUnique({
    where: { restaurantId },
    include: { plan: true }
  });

  if (!subscription) {
    return { subscription: null };
  }

  return {
    subscription: {
      id: subscription.id,
      status: subscription.status,
      activatedAt: subscription.activatedAt,
      plan: subscription.plan
        ? {
            id: subscription.plan.id,
            code: subscription.plan.code,
            displayName: subscription.plan.displayName,
            monthlyPrice: subscription.plan.monthlyPrice
          }
        : null
    }
  };
}

module.exports = {
  SubscriptionPaymentError,
  startSubscriptionCheckout,
  handleSubscriptionCallback,
  getSubscriptionPaymentStatus
};
