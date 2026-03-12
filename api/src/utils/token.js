const jwt = require("jsonwebtoken");
const config = require("../config");

function signUserToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      systemRole: user.systemRole,
      restaurantId: user.restaurantId || null
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = {
  signUserToken,
  verifyToken
};
