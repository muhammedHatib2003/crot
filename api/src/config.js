require("dotenv").config();

function normalizeOrigin(value) {
  if (!value) {
    return "";
  }
  return String(value).trim().replace(/\/+$/, "");
}

function parseOriginList(value) {
  if (!value) {
    return [];
  }
  return String(value)
    .split(",")
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);
}

function isLocalOrigin(value) {
  return /localhost|127\.0\.0\.1/i.test(String(value || ""));
}

function resolvePublicAppUrl() {
  const candidates = [
    normalizeOrigin(process.env.PUBLIC_APP_URL),
    normalizeOrigin(process.env.CLIENT_URL || process.env.CLIENT_ORIGIN),
    ...parseOriginList(process.env.CLIENT_ORIGINS)
  ].filter(Boolean);

  const publicCandidate = candidates.find((entry) => !isLocalOrigin(entry));
  if (publicCandidate) {
    return publicCandidate;
  }

  return candidates[0] || "http://localhost:5173";
}

function resolveApiUrl() {
  const explicit = normalizeOrigin(process.env.API_URL);
  if (explicit && !isLocalOrigin(explicit)) {
    return explicit;
  }

  const renderExternal = normalizeOrigin(process.env.RENDER_EXTERNAL_URL);
  if (renderExternal) {
    return renderExternal;
  }

  return explicit || "http://localhost:4000";
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

module.exports = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || "change-this-secret",
  servicePasskey: process.env.SERVICE_PASSKEY || "restaurant-pass-123",
  superAdminName: process.env.SUPER_ADMIN_NAME || "Super Admin",
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || "admin@crot.local",
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || "admin123",
  clientUrl: normalizeOrigin(process.env.CLIENT_URL || process.env.CLIENT_ORIGIN) || "http://localhost:5173",
  publicAppUrl: resolvePublicAppUrl(),
  extraClientOrigins: parseOriginList(process.env.CLIENT_ORIGINS),
  apiUrl: resolveApiUrl(),
  iyzico: {
    apiKey: process.env.IYZICO_API_KEY || "",
    secretKey: process.env.IYZICO_SECRET_KEY || "",
    baseUrl: process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com"
  }
};
