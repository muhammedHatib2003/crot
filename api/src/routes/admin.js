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

function mapCourierAccountRow(account) {
  return {
    id: account.id,
    fullName: account.fullName,
    email: account.email,
    phone: account.phone,
    status: account.status,
    documentUrl: account.documentUrl,
    documentOriginalName: account.documentOriginalName,
    restaurantId: account.restaurantId,
    restaurant: account.restaurant
      ? {
          id: account.restaurant.id,
          name: account.restaurant.name
        }
      : null,
    rejectionReason: account.rejectionReason,
    reviewedAt: account.reviewedAt,
    reviewedBy: account.reviewedBy
      ? {
          id: account.reviewedBy.id,
          fullName: account.reviewedBy.fullName,
          email: account.reviewedBy.email
        }
      : null,
    createdAt: account.createdAt
  };
}

router.get("/restaurants", async (req, res, next) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      select: { id: true, name: true, city: true, slug: true },
      orderBy: { name: "asc" }
    });
    return res.json({ restaurants });
  } catch (error) {
    return next(error);
  }
});

router.get("/courier-accounts", async (req, res, next) => {
  try {
    const status = String(req.query.status || "").trim().toUpperCase();
    const where =
      status && ["PENDING", "APPROVED", "REJECTED"].includes(status) ? { status } : {};

    const accounts = await prisma.courierAccount.findMany({
      where,
      include: {
        restaurant: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return res.json({
      accounts: accounts.map(mapCourierAccountRow)
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/courier-accounts/:courierId/approve", async (req, res, next) => {
  try {
    const courierId = String(req.params.courierId || "").trim();

    const account = await prisma.courierAccount.findUnique({ where: { id: courierId } });

    if (!account) {
      return res.status(404).json({ message: "Courier application not found." });
    }

    if (account.status !== "PENDING") {
      return res.status(409).json({ message: "Only pending applications can be approved." });
    }

    const updated = await prisma.courierAccount.update({
      where: { id: courierId },
      data: {
        status: "APPROVED",
        restaurantId: null,
        reviewedByUserId: req.auth.userId,
        reviewedAt: new Date(),
        rejectionReason: null
      },
      include: {
        restaurant: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true } }
      }
    });

    return res.json({
      message: "Courier approved.",
      account: mapCourierAccountRow(updated)
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/courier-accounts/:courierId/reject", async (req, res, next) => {
  try {
    const courierId = String(req.params.courierId || "").trim();
    const rejectionReason = String(req.body?.rejectionReason || "").trim() || "Rejected by administrator.";

    const account = await prisma.courierAccount.findUnique({ where: { id: courierId } });
    if (!account) {
      return res.status(404).json({ message: "Courier application not found." });
    }

    if (account.status !== "PENDING") {
      return res.status(409).json({ message: "Only pending applications can be rejected." });
    }

    const updated = await prisma.courierAccount.update({
      where: { id: courierId },
      data: {
        status: "REJECTED",
        rejectionReason,
        reviewedByUserId: req.auth.userId,
        reviewedAt: new Date(),
        restaurantId: null
      },
      include: {
        restaurant: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true } }
      }
    });

    return res.json({
      message: "Courier application rejected.",
      account: mapCourierAccountRow(updated)
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
