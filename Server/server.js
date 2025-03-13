require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { cleanEnv, str, num } = require("envalid");
const logger = require("./utils/logger");
const { API_VERSION } = require("./config");

// Validate environment variables
const env = cleanEnv(process.env, {
  MONGO: str(),
  AWS_REGION: str(),
  KEY_ID: str(),
  ACCESS_KEY: str(),
  S3_BUCKET_NAME: str(),
  PORT: num({ default: 3000 }),
  ALLOWED_ORIGINS: str(),
  RATE_LIMIT_MAX: num({ default: 100 }), 
});

// Initialize Express
const app = express();
app.set("trust proxy", 1);

// Middleware
app.use(helmet());
app.use(cors({ origin: env.ALLOWED_ORIGINS.split(",") }));
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: { success: false, error: "Too many requests, please try again later" }
  })
);

// Logging Middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// MongoDB Connection
mongoose
  .connect(env.MONGO)
  .then(() => logger.info("✅ MongoDB Connected"))
  .catch((err) => {
    logger.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

// Routes
app.use(`${API_VERSION}/shop`, require("./routes/shop"));
app.use(`${API_VERSION}/user`, require("./routes/user"));
app.use(`${API_VERSION}/customer`, require("./routes/customer"));
app.use(`${API_VERSION}/aari`, require("./routes/aari"));

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(`❌ ${req.method} ${req.url} - Error: ${err.message}`, { stack: err.stack });
  res.status(500).json({ success: false, error: "Internal Server Error" });
});

// Start Server
const port = env.PORT;
const server = app.listen(port, () => logger.info(`🚀 Server running on port ${port}`));

// Graceful Shutdown
process.on("SIGTERM", async () => {
  try {
    logger.info("🛑 SIGTERM received. Shutting down gracefully...");
    await mongoose.connection.close();
    server.close(() => {
      logger.info("✅ Server closed. Exiting process...");
      process.exit(0);
    });
  } catch (err) {
    logger.error("❌ Error during shutdown:", err);
    process.exit(1);
  }
});
