require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || "change-this-secret",
  servicePasskey: process.env.SERVICE_PASSKEY || "restaurant-pass-123",
  superAdminName: process.env.SUPER_ADMIN_NAME || "Super Admin",
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || "admin@crot.local",
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || "admin123",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  apiUrl: process.env.API_URL || "http://localhost:4000",
  iyzico: {
    apiKey: process.env.IYZICO_API_KEY || "",
    secretKey: process.env.IYZICO_SECRET_KEY || "",
    baseUrl: process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com"
  }
};
