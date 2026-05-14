const express = require("express");
const prisma = require("../db");
const { hashPassword, comparePassword } = require("../utils/password");
const { signCustomerToken } = require("../utils/token");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeText(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function mapCustomer(customer) {
  return {
    id: customer.id,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone || null,
    createdAt: customer.createdAt
  };
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({
    success: false,
    message
  });
}

router.post("/signup", async (req, res) => {
  try {
    const fullName = normalizeText(req.body?.fullName);
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const phone = normalizeText(req.body?.phone);

    if (!fullName || !email || !password) {
      return sendError(res, 400, "fullName, email and password are required.");
    }

    if (password.length < 6) {
      return sendError(res, 400, "Password must be at least 6 characters.");
    }

    const existingCustomer = await prisma.customer.findUnique({
      where: {
        email
      },
      select: {
        id: true
      }
    });

    if (existingCustomer) {
      return sendError(res, 409, "Email is already registered.");
    }

    const passwordHash = await hashPassword(password);
    const customer = await prisma.customer.create({
      data: {
        fullName,
        email,
        phone,
        passwordHash
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        token: signCustomerToken(customer),
        customer: mapCustomer(customer)
      }
    });
  } catch (error) {
    console.error("POST /api/customer/auth/signup failed:", error);
    return sendError(res, 500, "Internal server error.");
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return sendError(res, 400, "email and password are required.");
    }

    const customer = await prisma.customer.findUnique({
      where: {
        email
      }
    });

    if (!customer) {
      return sendError(res, 401, "Invalid credentials.");
    }

    const isValidPassword = await comparePassword(password, customer.passwordHash);
    if (!isValidPassword) {
      return sendError(res, 401, "Invalid credentials.");
    }

    return res.status(200).json({
      success: true,
      data: {
        token: signCustomerToken(customer),
        customer: mapCustomer(customer)
      }
    });
  } catch (error) {
    console.error("POST /api/customer/auth/login failed:", error);
    return sendError(res, 500, "Internal server error.");
  }
});

router.get("/me", authenticate, async (req, res) => {
  try {
    const customerId = String(req.auth?.customerId || req.auth?.userId || "").trim();
    if (!customerId) {
      return sendError(res, 401, "Authentication required.");
    }

    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId
      }
    });

    if (!customer) {
      return sendError(res, 404, "Customer not found.");
    }

    return res.status(200).json({
      success: true,
      data: {
        customer: mapCustomer(customer)
      }
    });
  } catch (error) {
    console.error("GET /api/customer/auth/me failed:", error);
    return sendError(res, 500, "Internal server error.");
  }
});

module.exports = router;
