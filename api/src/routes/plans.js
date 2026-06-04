const express = require("express");
const prisma = require("../db");
const { mapPlan } = require("../utils/plans");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: "asc" }
    });

    return res.json({
      plans: plans.map(mapPlan)
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
