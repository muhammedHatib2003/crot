const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__crotPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__crotPrisma = prisma;
}

module.exports = prisma;
