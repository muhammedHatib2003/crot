const express = require("express");
const prisma = require("../db");
const { authenticate, requireRoles } = require("../middleware/auth");
const {
  ALLOWED_BILLING_PERIODS,
  ALLOWED_CURRENCIES,
  mapPlan,
  normalizeFeatures,
  normalizeLimits,
  slugifyCode
} = require("../utils/plans");

const router = express.Router();

function parseMonthlyPrice(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeTextField(rawValue) {
  return String(rawValue || "").trim();
}

function pickPlanFieldsFromBody(body) {
  const data = {};
  const errors = [];

  if (Object.prototype.hasOwnProperty.call(body, "displayName")) {
    const displayName = normalizeTextField(body.displayName);
    if (!displayName) {
      errors.push("displayName cannot be empty.");
    } else {
      data.displayName = displayName;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    data.description = normalizeTextField(body.description);
  }

  if (Object.prototype.hasOwnProperty.call(body, "monthlyPrice")) {
    const monthlyPrice = parseMonthlyPrice(body.monthlyPrice);
    if (monthlyPrice === null) {
      errors.push("monthlyPrice must be a whole number greater than 0.");
    } else {
      data.monthlyPrice = monthlyPrice;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "currency")) {
    const currency = normalizeTextField(body.currency).toUpperCase() || "TRY";
    if (!ALLOWED_CURRENCIES.has(currency)) {
      errors.push(`currency must be one of: ${Array.from(ALLOWED_CURRENCIES).join(", ")}.`);
    } else {
      data.currency = currency;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "billingPeriod")) {
    const billingPeriod = normalizeTextField(body.billingPeriod).toLowerCase() || "monthly";
    if (!ALLOWED_BILLING_PERIODS.has(billingPeriod)) {
      errors.push(`billingPeriod must be one of: ${Array.from(ALLOWED_BILLING_PERIODS).join(", ")}.`);
    } else {
      data.billingPeriod = billingPeriod;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
    if (typeof body.isActive !== "boolean") {
      errors.push("isActive must be boolean.");
    } else {
      data.isActive = body.isActive;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "features")) {
    const features = normalizeFeatures(body.features);
    if (features === null && body.features !== null) {
      errors.push("features must be an object of boolean flags.");
    } else {
      data.features = features;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "limits")) {
    const limits = normalizeLimits(body.limits);
    if (limits === null && body.limits !== null) {
      errors.push("limits must be an object of numeric limits.");
    } else {
      data.limits = limits;
    }
  }

  return { data, errors };
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
      orderBy: [{ isActive: "desc" }, { monthlyPrice: "asc" }]
    });

    return res.json({
      plans: plans.map(mapPlan)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/plans", async (req, res, next) => {
  try {
    const body = req.body || {};
    const { data, errors } = pickPlanFieldsFromBody(body);

    if (!data.displayName) {
      errors.push("displayName is required.");
    }
    if (data.monthlyPrice === undefined) {
      errors.push("monthlyPrice is required.");
    }

    const requestedCode = normalizeTextField(body.code).toUpperCase();
    const slugSource = requestedCode || slugifyCode(data.displayName || "");
    const baseCode = slugSource || `PLAN_${Date.now().toString(36).toUpperCase()}`;

    let finalCode = baseCode;
    let attempt = 0;
    while (attempt < 25) {
      const existing = await prisma.plan.findUnique({ where: { code: finalCode } });
      if (!existing) {
        break;
      }
      attempt += 1;
      finalCode = `${baseCode}_${attempt}`;
    }

    if (attempt >= 25) {
      errors.push("Could not allocate a unique plan code, please provide one explicitly.");
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join(" ") });
    }

    const createdPlan = await prisma.plan.create({
      data: {
        code: finalCode,
        displayName: data.displayName,
        description: data.description || "",
        monthlyPrice: data.monthlyPrice,
        currency: data.currency || "TRY",
        billingPeriod: data.billingPeriod || "monthly",
        isActive: data.isActive === undefined ? true : data.isActive,
        features: data.features || {},
        limits: data.limits || {}
      }
    });

    return res.status(201).json({
      message: "Plan created.",
      plan: mapPlan(createdPlan)
    });
  } catch (error) {
    if (error && error.code === "P2002") {
      return res.status(409).json({ message: "Plan code already exists." });
    }
    return next(error);
  }
});

async function updatePlan(req, res, next) {
  try {
    const planId = String(req.params.planId || "").trim();
    if (!planId) {
      return res.status(400).json({ message: "planId is required." });
    }

    const body = req.body || {};
    const { data, errors } = pickPlanFieldsFromBody(body);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join(" ") });
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No editable fields provided." });
    }

    const existingPlan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!existingPlan) {
      return res.status(404).json({ message: "Plan not found." });
    }

    const updatedPlan = await prisma.plan.update({
      where: { id: planId },
      data
    });

    return res.json({
      message: "Plan updated.",
      plan: mapPlan(updatedPlan)
    });
  } catch (error) {
    return next(error);
  }
}

router.patch("/plans/:planId", updatePlan);
router.put("/plans/:planId", updatePlan);

router.patch("/plans/:planId/status", async (req, res, next) => {
  try {
    const planId = String(req.params.planId || "").trim();
    if (!planId) {
      return res.status(400).json({ message: "planId is required." });
    }

    if (typeof req.body?.isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be boolean." });
    }

    const existingPlan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!existingPlan) {
      return res.status(404).json({ message: "Plan not found." });
    }

    const updatedPlan = await prisma.plan.update({
      where: { id: planId },
      data: { isActive: req.body.isActive }
    });

    return res.json({
      message: req.body.isActive ? "Plan activated." : "Plan deactivated.",
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
