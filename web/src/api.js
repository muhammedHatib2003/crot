function resolveApiBaseUrl() {
  const rawBase = import.meta.env.VITE_API_BASE_URL;
  const rawRoot = import.meta.env.VITE_API_URL;
  const fallback = "http://localhost:4000";

  const candidate = (rawBase || rawRoot || fallback).trim();
  const withoutTrailingSlash = candidate.replace(/\/+$/, "");

  if (/\/api$/i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  return `${withoutTrailingSlash}/api`;
}

const API_BASE_URL = resolveApiBaseUrl();

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function getApiOrigin() {
  return String(API_BASE_URL).replace(/\/api\/?$/, "");
}

export async function apiFormPost(path, formData) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || "Request failed.");
    error.details = payload.details;
    error.status = response.status;
    throw error;
  }

  return payload;
}

function toQueryString(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    query.set(key, String(value));
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function apiRequest(path, options = {}) {
  const { method = "GET", token, body } = options;
  const headers = { "Content-Type": "application/json" };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || "Request failed.");
    error.details = payload.details;
    throw error;
  }

  return payload;
}

export async function getOnlineRestaurants(params = {}) {
  const payload = await apiRequest(`/online/restaurants${toQueryString(params)}`);
  return payload.data || {};
}

export async function getOnlineRestaurantBySlug(slug, params = {}) {
  const payload = await apiRequest(`/online/restaurants/${encodeURIComponent(slug)}${toQueryString(params)}`);
  return payload.data || {};
}

export async function getOnlineRestaurantMenu(slug) {
  const payload = await apiRequest(`/online/restaurants/${encodeURIComponent(slug)}/menu`);
  return payload.data || {};
}

export async function createOnlineOrder(payload, token) {
  const response = await apiRequest("/online/orders", {
    method: "POST",
    token,
    body: payload
  });
  return response.data || {};
}

export async function signupOnlineCustomer(payload) {
  const response = await apiRequest("/customer/auth/signup", {
    method: "POST",
    body: payload
  });
  return response.data || {};
}

export async function loginOnlineCustomer(payload) {
  const response = await apiRequest("/customer/auth/login", {
    method: "POST",
    body: payload
  });
  return response.data || {};
}

export async function getOnlineCustomerProfile(token) {
  const response = await apiRequest("/customer/auth/me", {
    token
  });
  return response.data || {};
}

export async function getMyAddresses(token) {
  const response = await apiRequest("/me/addresses", {
    token
  });
  return response.data || {};
}

export async function createMyAddress(payload, token) {
  const response = await apiRequest("/me/addresses", {
    method: "POST",
    token,
    body: payload
  });
  return response.data || {};
}

export async function updateMyAddress(addressId, payload, token) {
  const response = await apiRequest(`/me/addresses/${encodeURIComponent(addressId)}`, {
    method: "PUT",
    token,
    body: payload
  });
  return response.data || {};
}

export async function deleteMyAddress(addressId, token) {
  const response = await apiRequest(`/me/addresses/${encodeURIComponent(addressId)}`, {
    method: "DELETE",
    token
  });
  return response.data || {};
}

export async function getMyOnlineOrders(token) {
  const payload = await apiRequest("/me/orders", { token });
  return payload.data || {};
}

export async function getOwnerOnlineRestaurantSettings(token) {
  const payload = await apiRequest("/owner/restaurant/settings", { token });
  return payload.data || {};
}

export async function updateOwnerOnlineRestaurantSettings(payload, token) {
  const response = await apiRequest("/owner/restaurant/settings", {
    method: "PUT",
    token,
    body: payload
  });
  return response.data || {};
}

export async function getOwnerMenuCategories(token) {
  const payload = await apiRequest("/owner/menu/categories", { token });
  return payload.data || {};
}

export async function createOwnerMenuCategory(payload, token) {
  const response = await apiRequest("/owner/menu/categories", {
    method: "POST",
    token,
    body: payload
  });
  return response.data || {};
}

export async function updateOwnerMenuCategory(categoryId, payload, token) {
  const response = await apiRequest(`/owner/menu/categories/${encodeURIComponent(categoryId)}`, {
    method: "PUT",
    token,
    body: payload
  });
  return response.data || {};
}

export async function deleteOwnerMenuCategory(categoryId, token) {
  const response = await apiRequest(`/owner/menu/categories/${encodeURIComponent(categoryId)}`, {
    method: "DELETE",
    token
  });
  return response.data || {};
}

export async function getOwnerMenuProducts(token) {
  const payload = await apiRequest("/owner/menu/products", { token });
  return payload.data || {};
}

export async function createOwnerMenuProduct(payload, token) {
  const response = await apiRequest("/owner/menu/products", {
    method: "POST",
    token,
    body: payload
  });
  return response.data || {};
}

export async function updateOwnerMenuProduct(productId, payload, token) {
  const response = await apiRequest(`/owner/menu/products/${encodeURIComponent(productId)}`, {
    method: "PUT",
    token,
    body: payload
  });
  return response.data || {};
}

export async function deleteOwnerMenuProduct(productId, token) {
  const response = await apiRequest(`/owner/menu/products/${encodeURIComponent(productId)}`, {
    method: "DELETE",
    token
  });
  return response.data || {};
}

export async function getOwnerOnlineOrders(token, params = {}) {
  const response = await apiRequest(`/owner/orders${toQueryString(params)}`, {
    token
  });
  return response.data || {};
}

export async function getOwnerOnlineOrderDetail(orderId, token) {
  const response = await apiRequest(`/owner/orders/${encodeURIComponent(orderId)}`, {
    token
  });
  return response.data || {};
}

export async function updateOwnerOnlineOrderStatus(orderId, status, token) {
  const response = await apiRequest(`/owner/orders/${encodeURIComponent(orderId)}/status`, {
    method: "PATCH",
    token,
    body: { status }
  });
  return response.data || {};
}

export async function createCustomerOrder(payload, token) {
  return createOnlineOrder(payload, token);
}

export async function startIyzicoCheckout(orderId, token) {
  const response = await apiRequest("/payments/iyzico/checkout", {
    method: "POST",
    token,
    body: { orderId }
  });
  return response.data || {};
}

export async function getIyzicoPaymentStatus(orderId, token) {
  const response = await apiRequest(`/payments/iyzico/orders/${encodeURIComponent(orderId)}`, {
    token
  });
  return response.data || {};
}
