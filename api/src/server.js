const express = require("express");
const cors = require("cors");
const config = require("./config");
const prisma = require("./db");
const authRoutes = require("./routes/auth");
const plansRoutes = require("./routes/plans");
const ownerRoutes = require("./routes/owner");
const adminRoutes = require("./routes/admin");
const employeeRoutes = require("./routes/employee");
const publicRoutes = require("./routes/public");

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
app.use("/api/employee", employeeRoutes);
app.use("/api/public", publicRoutes);

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
