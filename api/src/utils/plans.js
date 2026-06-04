const KNOWN_FEATURE_KEYS = [
  "onlineOrdering",
  "qrMenu",
  "tableManagement",
  "kitchenPanel",
  "cashierPanel",
  "courierModule",
  "warehouseModule",
  "reports",
  "customDomain",
  "multiLanguage",
  "prioritySupport"
];

const KNOWN_LIMIT_KEYS = [
  "maxProducts",
  "maxTables",
  "maxUsers",
  "maxBranches",
  "maxOrdersPerMonth"
];

const ALLOWED_BILLING_PERIODS = new Set(["monthly", "yearly"]);
const ALLOWED_CURRENCIES = new Set(["TRY", "USD", "EUR"]);

function slugifyCode(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

function normalizeFeatures(rawFeatures) {
  if (rawFeatures === undefined || rawFeatures === null) {
    return null;
  }
  if (typeof rawFeatures !== "object" || Array.isArray(rawFeatures)) {
    return null;
  }

  const normalized = {};
  for (const key of Object.keys(rawFeatures)) {
    const trimmedKey = String(key || "").trim();
    if (!trimmedKey) {
      continue;
    }
    normalized[trimmedKey] = Boolean(rawFeatures[key]);
  }
  return normalized;
}

function normalizeLimits(rawLimits) {
  if (rawLimits === undefined || rawLimits === null) {
    return null;
  }
  if (typeof rawLimits !== "object" || Array.isArray(rawLimits)) {
    return null;
  }

  const normalized = {};
  for (const key of Object.keys(rawLimits)) {
    const trimmedKey = String(key || "").trim();
    if (!trimmedKey) {
      continue;
    }

    const rawValue = rawLimits[key];
    if (rawValue === null || rawValue === "" || rawValue === undefined) {
      normalized[trimmedKey] = null;
      continue;
    }

    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      normalized[trimmedKey] = null;
      continue;
    }

    normalized[trimmedKey] = Math.floor(numericValue);
  }
  return normalized;
}

function mapPlan(plan) {
  if (!plan) {
    return null;
  }
  return {
    id: plan.id,
    code: plan.code,
    displayName: plan.displayName,
    description: plan.description,
    monthlyPrice: plan.monthlyPrice,
    currency: plan.currency || "TRY",
    billingPeriod: plan.billingPeriod || "monthly",
    isActive: plan.isActive !== false,
    features: plan.features || {},
    limits: plan.limits || {},
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt || plan.createdAt
  };
}

module.exports = {
  ALLOWED_BILLING_PERIODS,
  ALLOWED_CURRENCIES,
  KNOWN_FEATURE_KEYS,
  KNOWN_LIMIT_KEYS,
  mapPlan,
  normalizeFeatures,
  normalizeLimits,
  slugifyCode
};
