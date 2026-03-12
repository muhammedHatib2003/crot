require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || "change-this-secret",
  servicePasskey: process.env.SERVICE_PASSKEY || "restaurant-pass-123",
  superAdminName: process.env.SUPER_ADMIN_NAME || "Super Admin",
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || "admin@crot.local",
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || "admin123"
};
