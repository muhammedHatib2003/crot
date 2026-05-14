const prisma = require("../../db");
const config = require("../../config");
const iyzicoService = require("./iyzico.service");

const FALLBACK_KITCHEN_STATUS = "PENDING";

class PaymentError extends Error {
  constructor(message, statusCode = 400, code = "PAYMENT_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function buildResultRedirectUrl(status, orderId, extraParams = {}) {
  const url = new URL("/payment/result", config.clientUrl);
  url.searchParams.set("status", status);
  if (orderId) {
    url.searchParams.set("orderId", String(orderId));
  }
  for (const [key, value] of Object.entries(extraParams)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function buildCallbackUrl() {
  return `${String(config.apiUrl).replace(/\/$/, "")}/api/payments/iyzico/callback`;
}

async function loadOrderForCustomer(orderId, customerId) {
  const order = await prisma.order.findFirst({
    where: { id: orderId },
    include: {
      restaurant: { select: { id: true, name: true, city: true, slug: true } },
      items: true,
      orderPayment: true,
      customer: true
    }
  });

  if (!order) {
    throw new PaymentError("Siparis bulunamadi.", 404, "ORDER_NOT_FOUND");
  }

  const owns =
    (order.customerId && order.customerId === customerId) ||
    (order.customerUserId && order.customerUserId === customerId);

  if (!owns) {
    throw new PaymentError("Bu siparis size ait degil.", 403, "ORDER_NOT_OWNED");
  }

  if (order.source !== "ONLINE") {
    throw new PaymentError("Sadece online siparisler icin online odeme yapilabilir.", 400, "ORDER_NOT_ONLINE");
  }

  return order;
}

async function startIyzicoCheckout({ orderId, customer }) {
  const order = await loadOrderForCustomer(orderId, customer.id);

  if (order.paymentStatus === "PAID" || order.status === "PAID" || order.orderPayment?.status === "PAID") {
    throw new PaymentError("Bu siparis icin odeme zaten alinmis.", 409, "ORDER_ALREADY_PAID");
  }

  if (order.status === "CANCELLED" || order.status === "REJECTED") {
    throw new PaymentError("Iptal edilmis siparis icin odeme baslatilamaz.", 409, "ORDER_CANCELLED");
  }

  const totalAmount = Number(order.total || Number(order.totalCents || 0) / 100);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new PaymentError("Siparis toplami gecersiz.", 400, "ORDER_TOTAL_INVALID");
  }

  const conversationId = `ord-${order.id}-${Date.now()}`;
  const callbackUrl = buildCallbackUrl();

  let initResponse;
  try {
    initResponse = await iyzicoService.initializeCheckoutForm({
      order: {
        ...order,
        total: totalAmount,
        restaurant: order.restaurant
      },
      customer: order.customer || customer,
      callbackUrl,
      conversationId
    });
  } catch (error) {
    if (error.code === "IYZICO_CONFIG_MISSING") {
      throw new PaymentError(error.message, 503, error.code);
    }
    throw new PaymentError(
      error.message || "iyzico checkout form baslatilamadi.",
      502,
      error.code || "IYZICO_INITIALIZE_FAILED"
    );
  }

  const paymentRecord = await prisma.orderPayment.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      provider: "IYZICO",
      status: "PENDING",
      price: totalAmount,
      currency: "TRY",
      conversationId,
      token: initResponse.token || null,
      rawResponse: initResponse
    },
    update: {
      provider: "IYZICO",
      status: "PENDING",
      price: totalAmount,
      currency: "TRY",
      conversationId,
      token: initResponse.token || null,
      rawResponse: initResponse
    }
  });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentMethod: "ONLINE",
      paymentStatus: "PENDING",
      ...(order.status === "PAYMENT_FAILED" || !order.status ? { status: "PENDING_PAYMENT" } : {})
    }
  });

  return {
    payment: paymentRecord,
    paymentPageUrl: initResponse.paymentPageUrl || null,
    checkoutFormContent: initResponse.checkoutFormContent || null,
    token: initResponse.token,
    conversationId
  };
}

async function handleIyzicoCallback({ token }) {
  if (!token) {
    return {
      redirectUrl: buildResultRedirectUrl("failure", null, { reason: "missing_token" })
    };
  }

  const paymentRecord = await prisma.orderPayment.findFirst({
    where: { token }
  });

  if (!paymentRecord) {
    return {
      redirectUrl: buildResultRedirectUrl("failure", null, { reason: "payment_not_found" })
    };
  }

  let retrieveResponse;
  try {
    retrieveResponse = await iyzicoService.retrieveCheckoutForm({
      token,
      conversationId: paymentRecord.conversationId
    });
  } catch (error) {
    await prisma.orderPayment.update({
      where: { id: paymentRecord.id },
      data: {
        status: "FAILED",
        rawResponse: { error: error.message, body: error.iyzicoBody || null }
      }
    });

    await prisma.order.update({
      where: { id: paymentRecord.orderId },
      data: { paymentStatus: "FAILED", status: "PAYMENT_FAILED" }
    });

    return {
      redirectUrl: buildResultRedirectUrl("failure", paymentRecord.orderId, { reason: "iyzico_retrieve_failed" })
    };
  }

  const isSuccess =
    retrieveResponse.status === "success" &&
    String(retrieveResponse.paymentStatus || "").toUpperCase() === "SUCCESS";

  if (
    retrieveResponse.conversationId &&
    paymentRecord.conversationId &&
    retrieveResponse.conversationId !== paymentRecord.conversationId
  ) {
    await prisma.orderPayment.update({
      where: { id: paymentRecord.id },
      data: {
        status: "FAILED",
        rawResponse: retrieveResponse
      }
    });
    return {
      redirectUrl: buildResultRedirectUrl("failure", paymentRecord.orderId, { reason: "conversation_mismatch" })
    };
  }

  if (isSuccess) {
    await prisma.orderPayment.update({
      where: { id: paymentRecord.id },
      data: {
        status: "PAID",
        iyzicoPaymentId: retrieveResponse.paymentId ? String(retrieveResponse.paymentId) : null,
        rawResponse: retrieveResponse
      }
    });

    await prisma.order.update({
      where: { id: paymentRecord.orderId },
      data: {
        paymentStatus: "PAID",
        status: FALLBACK_KITCHEN_STATUS
      }
    });

    return {
      redirectUrl: buildResultRedirectUrl("success", paymentRecord.orderId)
    };
  }

  await prisma.orderPayment.update({
    where: { id: paymentRecord.id },
    data: {
      status: "FAILED",
      rawResponse: retrieveResponse
    }
  });

  await prisma.order.update({
    where: { id: paymentRecord.orderId },
    data: {
      paymentStatus: "FAILED",
      status: "PAYMENT_FAILED"
    }
  });

  return {
    redirectUrl: buildResultRedirectUrl("failure", paymentRecord.orderId, {
      reason: retrieveResponse.errorCode || retrieveResponse.errorMessage || "payment_failed"
    })
  };
}

module.exports = {
  PaymentError,
  startIyzicoCheckout,
  handleIyzicoCallback,
  buildResultRedirectUrl
};
