export function getPickupMenuPathCandidates(slug) {
  const normalizedSlug = encodeURIComponent(String(slug || "").trim());

  return [
    `/public/restaurants/${normalizedSlug}/menu`,
    `/public/tenants/${normalizedSlug}/menu`
  ];
}

export function getPickupOrdersPathCandidates(slug) {
  const normalizedSlug = encodeURIComponent(String(slug || "").trim());

  return [
    `/public/restaurants/${normalizedSlug}/orders`,
    `/public/tenants/${normalizedSlug}/orders`
  ];
}

export function getPickupOrderPathCandidates(slug, orderId) {
  const normalizedSlug = encodeURIComponent(String(slug || "").trim());
  const normalizedOrderId = encodeURIComponent(String(orderId || "").trim());

  return [
    `/public/restaurants/${normalizedSlug}/orders/${normalizedOrderId}`,
    `/public/tenants/${normalizedSlug}/orders/${normalizedOrderId}`
  ];
}

export async function apiRequestWithPathFallback(paths, options, apiRequest) {
  let lastError;

  for (const path of paths) {
    try {
      return await apiRequest(path, options);
    } catch (requestError) {
      lastError = requestError;
      const message = String(requestError.message || "");
      const isRouteMissing = /route not found/i.test(message);
      if (!isRouteMissing) {
        throw requestError;
      }
    }
  }

  throw lastError || new Error("Request failed.");
}
