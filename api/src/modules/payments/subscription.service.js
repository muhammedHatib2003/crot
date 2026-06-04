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

  const trimmed = conversationId.trim();
  const regexMatch = trimmed.match(/^sub-(.+)-([a-z0-9]+)$/i);
  if (regexMatch) {
    return { restaurantId: regexMatch[1], stamp: regexMatch[2] };
  }

  const parts = trimmed.split("-");
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

function normalizeMoneyAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(parsed * 100) / 100;
}

function pricesMatch(expected, paid) {
  const normalizedExpected = normalizeMoneyAmount(expected);
  const normalizedPaid = normalizeMoneyAmount(paid);
  if (normalizedExpected === null || normalizedPaid === null) {
    return false;
  }
  return Math.abs(normalizedPaid - normalizedExpected) < 0.02;
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
      status: "PENDING_PAYMENT",
      iyzicoToken: initResponse.token || null,
      iyzicoConversationId: conversationId
    },
    update: {
      planId,
      status: "PENDING_PAYMENT",
      iyzicoToken: initResponse.token || null,
      iyzicoConversationId: conversationId
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
      monthlyPrice: plan.monthlyPrice,
      currency: plan.currency || "TRY",
      billingPeriod: plan.billingPeriod || "monthly",
      features: plan.features || {},
      limits: plan.limits || {}
    }
  };
}

async function handleSubscriptionCallback({ token }) {
  if (!token) {
    return {
      redirectUrl: buildResultRedirectUrl("failure", { reason: "missing_token" })
    };
  }

  const subscriptionByToken = await prisma.subscription.findFirst({
    where: { iyzicoToken: token },
    include: { plan: true, restaurant: true }
  });

  let retrieveResponse;
  try {
    retrieveResponse = await iyzicoService.retrieveCheckoutForm({
      token,
      conversationId: subscriptionByToken?.iyzicoConversationId || undefined
    });
  } catch (error) {
    return {
      redirectUrl: buildResultRedirectUrl("failure", { reason: "iyzico_retrieve_failed" })
    };
  }

  let restaurantId = subscriptionByToken?.restaurantId || null;

  if (!restaurantId) {
    const parsed = parseConversationId(
      retrieveResponse.conversationId || subscriptionByToken?.iyzicoConversationId
    );
    restaurantId = parsed?.restaurantId || null;
  }

  if (!restaurantId) {
    return {
      redirectUrl: buildResultRedirectUrl("failure", { reason: "conversation_mismatch" })
    };
  }

  const subscription =
    subscriptionByToken ||
    (await prisma.subscription.findUnique({
      where: { restaurantId },
      include: { plan: true, restaurant: true }
    }));

  if (!subscription || !subscription.plan) {
    return {
      redirectUrl: buildResultRedirectUrl("failure", { reason: "subscription_not_found" })
    };
  }

  const storedConversationId = subscription.iyzicoConversationId || "";
  const returnedConversationId = String(retrieveResponse.conversationId || "").trim();
  if (
    storedConversationId &&
    returnedConversationId &&
    storedConversationId !== returnedConversationId
  ) {
    await prisma.subscription.update({
      where: { restaurantId },
      data: {
        status: "PAYMENT_FAILED",
        iyzicoToken: null
      }
    });
    return {
      redirectUrl: buildResultRedirectUrl("failure", {
        restaurantId,
        reason: "conversation_mismatch"
      })
    };
  }

  const isSuccess =
    retrieveResponse.status === "success" &&
    String(retrieveResponse.paymentStatus || "").toUpperCase() === "SUCCESS";

  const expectedPrice = subscription.plan.monthlyPrice;
  const paidPrice = retrieveResponse.paidPrice ?? retrieveResponse.price;
  const priceMatches = pricesMatch(expectedPrice, paidPrice);

  if (isSuccess && priceMatches) {
    await prisma.subscription.update({
      where: { restaurantId },
      data: {
        status: "ACTIVE",
        activatedAt: new Date(),
        iyzicoToken: null,
        iyzicoConversationId: null
      }
    });

    return {
      redirectUrl: buildResultRedirectUrl("success", {
        restaurantId,
        planCode: subscription.plan.code
      })
    };
  }

  await prisma.subscription.update({
    where: { restaurantId },
    data: {
      status: "PAYMENT_FAILED",
      iyzicoToken: null
    }
  });

  return {
    redirectUrl: buildResultRedirectUrl("failure", {
      restaurantId,
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
            monthlyPrice: subscription.plan.monthlyPrice,
            currency: subscription.plan.currency || "TRY",
            billingPeriod: subscription.plan.billingPeriod || "monthly",
            features: subscription.plan.features || {},
            limits: subscription.plan.limits || {}
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
