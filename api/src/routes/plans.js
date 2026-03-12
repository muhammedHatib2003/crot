const express = require("express");
const prisma = require("../db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { monthlyPrice: "asc" }
    });

    return res.json({
      plans: plans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        displayName: plan.displayName,
        monthlyPrice: plan.monthlyPrice,
        description: plan.description
      }))
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
