export function getDisplayOrdersPathCandidates(slug) {
  const normalizedSlug = encodeURIComponent(String(slug || "").trim());

  return [
    `/public/restaurants/${normalizedSlug}/display-orders`,
    `/public/tenants/${normalizedSlug}/display-orders`
  ];
}

export function getDisplayScreenPath(slug) {
  const normalizedSlug = encodeURIComponent(String(slug || "").trim());
  return `/display/${normalizedSlug}`;
}
