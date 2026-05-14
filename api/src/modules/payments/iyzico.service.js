const crypto = require("node:crypto");
const config = require("../../config");

const INITIALIZE_URI = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
const RETRIEVE_URI = "/payment/iyzipos/checkoutform/auth/ecom/detail";

function buildAuthHeader(uri, body) {
  const apiKey = config.iyzico.apiKey;
  const secretKey = config.iyzico.secretKey;

  if (!apiKey || !secretKey) {
    const error = new Error("iyzico API anahtarlari eksik. IYZICO_API_KEY ve IYZICO_SECRET_KEY doldurun.");
    error.code = "IYZICO_CONFIG_MISSING";
    throw error;
  }

  const randomKey = `${Date.now()}${Math.floor(Math.random() * 1_000_000_000)}`;
  const payload = randomKey + uri + body;
  const signature = crypto.createHmac("sha256", secretKey).update(payload).digest("hex");
  const authString = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  const authorization = `IYZWSv2 ${Buffer.from(authString).toString("base64")}`;

  return { authorization, randomKey };
}

async function postJson(uri, body) {
  const baseUrl = String(config.iyzico.baseUrl || "").replace(/\/$/, "");
  const json = JSON.stringify(body);
  const { authorization, randomKey } = buildAuthHeader(uri, json);

  const response = await fetch(`${baseUrl}${uri}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authorization,
      "x-iyzi-rnd": randomKey
    },
    body: json
  });

  let parsed = null;
  try {
    parsed = await response.json();
  } catch (parseError) {
    parsed = null;
  }

  if (!response.ok || !parsed) {
    const error = new Error(parsed?.errorMessage || `iyzico HTTP ${response.status}`);
    error.iyzicoStatus = response.status;
    error.iyzicoBody = parsed;
    throw error;
  }

  return parsed;
}

function buildBuyer({ customer, order }) {
  const fullName = String(order.customerName || customer.fullName || "Musteri").trim();
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(" ").trim() || firstName || "Soyad";

  const phone = String(order.customerPhone || customer.phone || "+905555555555").trim();
  const ip = "85.34.78.112";
  const identityNumber = "11111111111";

  return {
    id: `BY-${customer.id}`,
    name: firstName || "Ad",
    surname: lastName,
    gsmNumber: phone,
    email: customer.email,
    identityNumber,
    registrationAddress: order.deliveryAddressText || order.customerAddress || "Adres",
    ip,
    city: order.restaurant?.city || "Istanbul",
    country: "Turkey",
    zipCode: "34000"
  };
}

function buildAddress({ order, label }) {
  return {
    contactName: order.customerName || label,
    city: order.restaurant?.city || "Istanbul",
    country: "Turkey",
    address: order.deliveryAddressText || order.customerAddress || "Adres",
    zipCode: "34000"
  };
}

function buildBasketItems(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) {
    return [
      {
        id: `OI-${order.id}`,
        name: `Order ${order.orderCode || order.id}`,
        category1: "Food",
        itemType: "PHYSICAL",
        price: Number(order.total || 0).toFixed(2)
      }
    ];
  }

  return items.map((item) => {
    const unitPrice = Number(item.unitPriceSnapshot != null ? item.unitPriceSnapshot : Number(item.priceCents || 0) / 100);
    const lineTotal = Number(unitPrice * Number(item.quantity || 1));
    return {
      id: `OI-${item.id}`,
      name: String(item.productNameSnapshot || item.nameSnapshot || "Urun").slice(0, 60),
      category1: "Food",
      itemType: "PHYSICAL",
      price: lineTotal.toFixed(2)
    };
  });
}

function reconcilePrices(order, basketItems) {
  const itemsTotal = basketItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const orderTotal = Number(order.total || 0);
  const paidPrice = Number(orderTotal.toFixed(2));
  const price = Number(itemsTotal.toFixed(2)) || paidPrice;
  return { price, paidPrice };
}

async function initializeCheckoutForm({ order, customer, callbackUrl, conversationId }) {
  const basketItems = buildBasketItems(order);
  const { price, paidPrice } = reconcilePrices(order, basketItems);

  const body = {
    locale: "tr",
    conversationId,
    price: price.toFixed(2),
    paidPrice: paidPrice.toFixed(2),
    currency: "TRY",
    basketId: order.id,
    paymentGroup: "PRODUCT",
    callbackUrl,
    enabledInstallments: [1, 2, 3, 6, 9],
    buyer: buildBuyer({ customer, order }),
    shippingAddress: buildAddress({ order, label: "Teslimat" }),
    billingAddress: buildAddress({ order, label: "Fatura" }),
    basketItems
  };

  const result = await postJson(INITIALIZE_URI, body);

  if (result.status !== "success") {
    const error = new Error(result.errorMessage || "iyzico checkout form baslatilamadi.");
    error.code = result.errorCode || "IYZICO_INITIALIZE_FAILED";
    error.iyzicoBody = result;
    throw error;
  }

  return result;
}

async function retrieveCheckoutForm({ token, conversationId }) {
  const body = {
    locale: "tr",
    conversationId,
    token
  };

  return postJson(RETRIEVE_URI, body);
}

async function initializeSubscriptionCheckoutForm({
  owner,
  restaurant,
  plan,
  callbackUrl,
  conversationId
}) {
  const price = Number(plan.monthlyPrice);
  if (!Number.isFinite(price) || price <= 0) {
    const error = new Error("Plan ucreti gecersiz.");
    error.code = "PLAN_PRICE_INVALID";
    throw error;
  }

  const priceString = price.toFixed(2);

  const ownerName = String(owner.fullName || owner.email || "Restoran Sahibi").trim();
  const [firstName, ...rest] = ownerName.split(/\s+/);
  const lastName = rest.join(" ").trim() || firstName || "Soyad";

  const body = {
    locale: "tr",
    conversationId,
    price: priceString,
    paidPrice: priceString,
    currency: "TRY",
    basketId: `sub-${restaurant.id}`,
    paymentGroup: "SUBSCRIPTION",
    callbackUrl,
    enabledInstallments: [1, 2, 3],
    buyer: {
      id: `OWN-${owner.id}`,
      name: firstName || "Ad",
      surname: lastName,
      gsmNumber: String(owner.phone || "+905555555555").trim(),
      email: owner.email,
      identityNumber: "11111111111",
      registrationAddress: restaurant.name || "Adres",
      ip: "85.34.78.112",
      city: restaurant.city || "Istanbul",
      country: "Turkey",
      zipCode: "34000"
    },
    shippingAddress: {
      contactName: ownerName,
      city: restaurant.city || "Istanbul",
      country: "Turkey",
      address: restaurant.name || "Adres",
      zipCode: "34000"
    },
    billingAddress: {
      contactName: ownerName,
      city: restaurant.city || "Istanbul",
      country: "Turkey",
      address: restaurant.name || "Adres",
      zipCode: "34000"
    },
    basketItems: [
      {
        id: `PLAN-${plan.id}`,
        name: `${plan.displayName} Plan`.slice(0, 60),
        category1: "Subscription",
        itemType: "VIRTUAL",
        price: priceString
      }
    ]
  };

  const result = await postJson(INITIALIZE_URI, body);

  if (result.status !== "success") {
    const error = new Error(result.errorMessage || "iyzico abonelik formu baslatilamadi.");
    error.code = result.errorCode || "IYZICO_INITIALIZE_FAILED";
    error.iyzicoBody = result;
    throw error;
  }

  return result;
}

module.exports = {
  initializeCheckoutForm,
  initializeSubscriptionCheckoutForm,
  retrieveCheckoutForm
};
