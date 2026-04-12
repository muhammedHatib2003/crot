const express = require("express");
const prisma = require("../db");
const { hashPassword, comparePassword } = require("../utils/password");
const { signUserToken } = require("../utils/token");
const { authenticate } = require("../middleware/auth");
const { ensureUniqueRestaurantSlug } = require("../utils/slugs");

const router = express.Router();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    systemRole: user.systemRole,
    employeeRole: user.employeeRole,
    restaurantId: user.restaurantId,
    restaurantName: user.restaurant ? user.restaurant.name : null,
    restaurant: user.restaurant
      ? {
          id: user.restaurant.id,
          name: user.restaurant.name,
          slug: user.restaurant.slug,
          phone: user.restaurant.phone,
          logoUrl: user.restaurant.logoUrl,
          publicOrderingEnabled: user.restaurant.publicOrderingEnabled,
          pickupEnabled: user.restaurant.pickupEnabled
        }
      : null
  };
}

router.post("/owner-signup", async (req, res, next) => {
  try {
    const { fullName, email, password, phone, restaurantName, restaurantPhone } = req.body;

    if (!fullName || !email || !password || !restaurantName) {
      return res.status(400).json({
        message: "fullName, email, password, and restaurantName are required."
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const passwordHash = await hashPassword(password);

    const owner = await prisma.$transaction(async (tx) => {
      const restaurantSlug = await ensureUniqueRestaurantSlug(tx, restaurantName);

      const restaurant = await tx.restaurant.create({
        data: {
          name: String(restaurantName).trim(),
          slug: restaurantSlug,
          phone: restaurantPhone ? String(restaurantPhone).trim() : null
        }
      });

      return tx.user.create({
        data: {
          fullName: String(fullName).trim(),
          email: normalizedEmail,
          phone: phone ? String(phone).trim() : null,
          passwordHash,
          systemRole: "OWNER",
          restaurantId: restaurant.id
        },
        include: {
          restaurant: true
        }
      });
    });

    const token = signUserToken(owner);

    return res.status(201).json({
      token,
      user: sanitizeUser(owner)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required." });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { restaurant: true }
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = signUserToken(user);

    return res.json({
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { restaurant: true }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
