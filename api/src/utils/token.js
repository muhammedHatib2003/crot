const jwt = require("jsonwebtoken");
const config = require("../config");

function signUserToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      systemRole: user.systemRole,
      restaurantId: user.restaurantId || null,
      tokenType: "SYSTEM_USER"
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

function signCustomerToken(customer) {
  return jwt.sign(
    {
      userId: customer.id,
      customerId: customer.id,
      systemRole: "CUSTOMER",
      tokenType: "CUSTOMER"
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

function signCourierToken(account) {
  return jwt.sign(
    {
      courierAccountId: account.id,
      restaurantId: account.restaurantId || null,
      tokenType: "COURIER"
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = {
  signCourierToken,
  signCustomerToken,
  signUserToken,
  verifyToken
};
