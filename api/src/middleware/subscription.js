const prisma = require("../db");

function hasActiveSubscription(subscription) {
  return Boolean(subscription && subscription.status === "ACTIVE");
}

async function requireActiveSubscription(req, res, next) {
  try {
    if (!req.auth?.restaurantId) {
      return res.status(400).json({ message: "Owner has no restaurant assigned." });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { restaurantId: req.auth.restaurantId },
      include: {
        plan: true
      }
    });

    if (!hasActiveSubscription(subscription)) {
      return res.status(403).json({
        message: "Please select a plan before using owner tools.",
        requiresPlanSelection: true
      });
    }

    req.activeSubscription = subscription;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  hasActiveSubscription,
  requireActiveSubscription
};
