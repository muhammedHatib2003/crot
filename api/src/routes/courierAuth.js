const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const prisma = require("../db");
const { authenticateCourier } = require("../middleware/auth");
const { hashPassword, comparePassword } = require("../utils/password");
const { signCourierToken } = require("../utils/token");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "..", "uploads", "courier-docs");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const ok = [".pdf", ".jpg", ".jpeg", ".png", ".webp"].includes(ext);
    if (!ok) {
      cb(new Error("INVALID_DOCUMENT_TYPE"));
      return;
    }
    cb(null, true);
  }
});

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function mapCourierPublic(account) {
  if (!account) {
    return null;
  }

  return {
    id: account.id,
    fullName: account.fullName,
    email: account.email,
    phone: account.phone,
    status: account.status,
    restaurantId: account.restaurantId,
    restaurant: account.restaurant || null,
    documentUrl: account.documentUrl,
    documentOriginalName: account.documentOriginalName,
    rejectionReason: account.rejectionReason || null,
    createdAt: account.createdAt,
    reviewedAt: account.reviewedAt || null
  };
}

router.post("/register", (req, res, next) => {
  upload.single("document")(req, res, async (multerError) => {
    if (multerError) {
      if (multerError.message === "INVALID_DOCUMENT_TYPE") {
        return res.status(400).json({ message: "Document must be PDF, JPG, PNG, or WEBP." });
      }
      if (multerError.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Document must be 8 MB or smaller." });
      }
      return next(multerError);
    }

    try {
      const fullName = String(req.body?.fullName || "").trim();
      const email = normalizeEmail(req.body?.email);
      const password = req.body?.password;
      const phone = req.body?.phone ? String(req.body.phone).trim() : null;

      if (!fullName || !email || !password) {
        return res.status(400).json({ message: "fullName, email, and password are required." });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Courier certificate file (kurye belgesi) is required." });
      }

      if (String(password).length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters." });
      }

      const [existingUser, existingCourier] = await Promise.all([
        prisma.user.findUnique({ where: { email } }),
        prisma.courierAccount.findUnique({ where: { email } })
      ]);

      if (existingUser || existingCourier) {
        return res.status(409).json({ message: "Email is already registered." });
      }

      const relativeUrl = `/uploads/courier-docs/${req.file.filename}`;

      await prisma.courierAccount.create({
        data: {
          fullName,
          email,
          phone,
          passwordHash: await hashPassword(password),
          documentUrl: relativeUrl,
          documentOriginalName: req.file.originalname || null,
          status: "PENDING"
        }
      });

      return res.status(201).json({
        message:
          "Application submitted. A super admin will review your courier document. You can sign in only after approval.",
        status: "PENDING"
      });
    } catch (error) {
      return next(error);
    }
  });
});

router.post("/login", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required." });
    }

    const account = await prisma.courierAccount.findUnique({ where: { email } });
    if (!account) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const valid = await comparePassword(password, account.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (account.status === "PENDING") {
      return res.status(403).json({
        message:
          "Your courier document is still under review by the super admin. You can sign in after it is approved.",
        status: "PENDING"
      });
    }

    if (account.status === "REJECTED") {
      return res.status(403).json({
        message: account.rejectionReason || "Your application was rejected.",
        status: "REJECTED",
        rejectionReason: account.rejectionReason
      });
    }

    const withRestaurant = await prisma.courierAccount.findUnique({
      where: { id: account.id },
      include: {
        restaurant: {
          select: { id: true, name: true, slug: true, phone: true, logoUrl: true }
        }
      }
    });

    const token = signCourierToken(withRestaurant);
    return res.json({
      token,
      courier: mapCourierPublic(withRestaurant)
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticateCourier, (req, res) => {
  return res.json({ courier: mapCourierPublic(req.courierAccount) });
});

module.exports = router;
