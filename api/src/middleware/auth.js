const prisma = require("../db");
const { verifyToken } = require("../utils/token");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid authorization header." });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    req.auth = verifyToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.systemRole)) {
      return res.status(403).json({ message: "You are not allowed to access this resource." });
    }
    return next();
  };
}

async function authenticateCourier(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid authorization header." });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const payload = verifyToken(token);
    if (payload.tokenType !== "COURIER" || !payload.courierAccountId) {
      return res.status(401).json({ message: "Invalid or expired courier session." });
    }

    const account = await prisma.courierAccount.findUnique({
      where: { id: payload.courierAccountId },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            phone: true,
            logoUrl: true
          }
        }
      }
    });

    if (!account || account.status !== "APPROVED") {
      return res.status(403).json({ message: "Courier account is not approved." });
    }

    req.courierAccount = account;
    req.courierAuth = {
      courierAccountId: account.id,
      restaurantId: account.restaurantId || null
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

module.exports = {
  authenticate,
  authenticateCourier,
  requireRoles
};
