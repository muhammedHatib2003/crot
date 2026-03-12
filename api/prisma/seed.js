require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../src/db");
const config = require("../src/config");

const DEFAULT_PLANS = [
  {
    code: "STARTER",
    displayName: "Starter",
    monthlyPrice: 29,
    description: "Small cafe setup with basic employee management."
  },
  {
    code: "GROWTH",
    displayName: "Growth",
    monthlyPrice: 79,
    description: "Best for active restaurants with multiple teams."
  },
  {
    code: "PREMIUM",
    displayName: "Premium",
    monthlyPrice: 149,
    description: "Advanced tier for larger operations and scaling."
  }
];

async function seedPlans() {
  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        displayName: plan.displayName,
        monthlyPrice: plan.monthlyPrice,
        description: plan.description
      },
      create: plan
    });
  }
}

async function seedSuperAdmin() {
  const email = config.superAdminEmail;
  const password = config.superAdminPassword;

  if (!email || !password) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: {
      fullName: config.superAdminName,
      passwordHash,
      systemRole: "SUPER_ADMIN",
      restaurantId: null,
      employeeRole: null
    },
    create: {
      fullName: config.superAdminName,
      email,
      passwordHash,
      systemRole: "SUPER_ADMIN"
    }
  });
}

async function main() {
  await seedPlans();
  await seedSuperAdmin();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed completed.");
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    console.error("Seed failed:", error);
    process.exit(1);
  });
