const path = require("path");
const express = require("express");
const cors = require("cors");
const config = require("./config");
const prisma = require("./db");
const authRoutes = require("./routes/auth");
const plansRoutes = require("./routes/plans");
const ownerRoutes = require("./routes/owner");
const adminRoutes = require("./routes/admin");
const restaurantRoutes = require("./routes/restaurant");
const kitchenRoutes = require("./routes/kitchen");
const paymentRoutes = require("./routes/payment");
const waiterRoutes = require("./routes/waiter");
const inventoryRoutes = require("./routes/inventory");
const publicRoutes = require("./routes/public");
const publicOnlineOrderRoutes = require("./routes/publicOnlineOrder");
const customerOrdersRoutes = require("./routes/customerOrders");
const customerAuthRoutes = require("./routes/customerAuth");
const onlineRoutes = require("./routes/online");
const meRoutes = require("./routes/me");
const ownerOnlineRoutes = require("./routes/ownerOnline");
const courierRoutes = require("./routes/courier");
const courierAuthRoutes = require("./routes/courierAuth");
const iyzicoRoutes = require("./modules/payments/iyzico.routes");

const app = express();

app.use(
  cors({
    origin: true,
    credentials: false
  })
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/plans", plansRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/cashier", paymentRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/waiter", waiterRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/restaurant", restaurantRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/public", publicOnlineOrderRoutes);
app.use("/api/customer/auth", customerAuthRoutes);
app.use("/api/customer/orders", customerOrdersRoutes);
app.use("/api/online", onlineRoutes);
app.use("/api/me", meRoutes);
app.use("/api/owner", ownerOnlineRoutes);
app.use("/api/courier-auth", courierAuthRoutes);
app.use("/api/courier", courierRoutes);
app.use("/api/payments", iyzicoRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    message: "Internal server error."
  });
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}`);
});
