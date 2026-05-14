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
  extraClientOrigins: parseOriginList(process.env.CLIENT_ORIGINS),
  apiUrl: process.env.API_URL || "http://localhost:4000",
  iyzico: {
    apiKey: process.env.IYZICO_API_KEY || "",
    secretKey: process.env.IYZICO_SECRET_KEY || "",
    baseUrl: process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com"
  }
};
