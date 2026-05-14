const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
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

app.disable("x-powered-by");
app.set("trust proxy", 1);

function normalizeOriginValue(value) {
  if (!value) {
    return "";
  }
  return String(value).trim().replace(/\/+$/, "").toLowerCase();
}

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000"
];

const allowedOrigins = new Set(
  [config.clientUrl, ...config.extraClientOrigins, ...DEFAULT_DEV_ORIGINS]
    .map(normalizeOriginValue)
    .filter(Boolean)
);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalized = normalizeOriginValue(origin);

    if (allowedOrigins.has(normalized)) {
      return callback(null, true);
    }

    if (!config.isProduction) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
};

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"), {
    fallthrough: true,
    maxAge: "1d"
  })
);

function healthHandler(req, res) {
  res.json({
    ok: true,
    service: "api",
    env: config.nodeEnv,
    time: new Date().toISOString()
  });
}

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

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

app.use((error, req, res, _next) => {
  if (error && /not allowed by CORS/i.test(error.message || "")) {
    return res.status(403).json({ message: "Origin not allowed." });
  }

  if (!config.isProduction) {
    console.error(error);
  } else {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${error?.message || error}`);
  }

  const status = error?.status || 500;
  const payload = { message: status === 500 ? "Internal server error." : error.message };

  if (!config.isProduction && error?.stack) {
    payload.stack = error.stack;
  }

  return res.status(status).json(payload);
});

async function shutdown(signal) {
  try {
    await prisma.$disconnect();
  } catch (error) {
    if (!config.isProduction) {
      console.error("Prisma disconnect error", error);
    }
  }
  process.exit(signal === "SIGTERM" ? 0 : 0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const PORT = process.env.PORT || config.port;

app.listen(PORT, () => {
  if (!config.isProduction) {
    console.log(`API running on http://localhost:${PORT}`);
  } else {
    console.log(`API listening on port ${PORT} (${config.nodeEnv})`);
  }
});

module.exports = app;
