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

module.exports = {
  authenticate,
  requireRoles
};
