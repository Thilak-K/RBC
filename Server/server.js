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
  JWT_SECRET: str(), 
  REDIS_URL: str({ default: "redis://localhost:6379" }),
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
  })
);
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// MongoDB Connection
mongoose
  .connect(env.MONGO)
  .then(() => logger.info("MongoDB Connected"))
  .catch((err) => {
    logger.error("MongoDB Connection Error:", err);
    process.exit(1);
  });

// Routes
const shopRoutes = require("./routes/shop");
const userRoutes = require("./routes/user");
const customerRoutes = require("./routes/customer");
const aariRoutes = require("./routes/aari");

app.use(`${API_VERSION}/shop`, shopRoutes);
app.use(`${API_VERSION}/user`, userRoutes);
app.use(`${API_VERSION}/customer`, customerRoutes);
app.use(`${API_VERSION}/aari`, aariRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(`${req.method} ${req.url} - Error: ${err.message}`, { stack: err.stack });
  if (err instanceof multer.MulterError) return res.status(400).json({ success: false, error: err.message });
  res.status(500).json({ success: false, error: "Internal Server Error" });
});

// Start Server
const port = env.PORT;
const server = app.listen(port, () => logger.info(`Server is listening on port ${port}`));

// Graceful Shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Shutting down gracefully...");
  server.close();
  await mongoose.connection.close();
  process.exit(0);
});