const express = require("express");
const prisma = require("../db");
const { authenticate, requireRoles } = require("../middleware/auth");

const router = express.Router();

function mapPlan(plan) {
  return {
    id: plan.id,
    code: plan.code,
    displayName: plan.displayName,
    monthlyPrice: plan.monthlyPrice,
    description: plan.description
  };
}

function parseMonthlyPrice(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

router.use(authenticate, requireRoles("SUPER_ADMIN"));

router.get("/users", async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        restaurant: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return res.json({
      users: users.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        systemRole: user.systemRole,
        employeeRole: user.employeeRole,
        restaurantName: user.restaurant ? user.restaurant.name : null,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/plans", async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { monthlyPrice: "asc" }
    });

    return res.json({
      plans: plans.map(mapPlan)
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/plans/:planId", async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { monthlyPrice } = req.body;

    const normalizedPrice = parseMonthlyPrice(monthlyPrice);
    if (normalizedPrice === null) {
      return res.status(400).json({ message: "monthlyPrice must be a whole number greater than 0." });
    }

    const existingPlan = await prisma.plan.findUnique({
      where: { id: planId }
    });

    if (!existingPlan) {
      return res.status(404).json({ message: "Plan not found." });
    }

    const updatedPlan = await prisma.plan.update({
      where: { id: planId },
      data: {
        monthlyPrice: normalizedPrice
      }
    });

    return res.json({
      message: "Plan price updated.",
      plan: mapPlan(updatedPlan)
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
