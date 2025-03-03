require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const rateLimit = require("express-rate-limit");
const winston = require("winston");
const Joi = require("joi");

// Initialize Express
const app = express();

// Environment Variable Validation
const requiredEnvVars = ["MONGO", "AWS_REGION", "KEY_ID", "ACCESS_KEY", "S3_BUCKET_NAME", "PORT"];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Missing environment variable: ${varName}`);
    process.exit(1);
  }
});

// Logger Setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// Middleware
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || "http://localhost:3000" }));
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
  })
);

// MongoDB Connection
mongoose
  .connect(process.env.MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => logger.info("MongoDB Connected"))
  .catch((err) => {
    logger.error("MongoDB Connection Error:", err);
    process.exit(1);
  });

// AWS S3 Configuration
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.KEY_ID,
    secretAccessKey: process.env.ACCESS_KEY,
  },
});

// Models
const Shop = require("./models/Shop");
const User = require("./models/User");
const Aari = require("./models/Aari");

// Constants
const STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
};

// Multer Configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, JPEG, and PNG images are allowed."));
  },
});

// Validation Schemas
const submitAariSchema = Joi.object({
  orderid: Joi.string().required(),
  name: Joi.string().required(),
  phonenumber: Joi.string().required(),
  submissiondate: Joi.date().iso().required(),
  deliverydate: Joi.date().iso().required(),
  address: Joi.string().required(),
  additionalinformation: Joi.string().allow(""),
  staffname: Joi.string().required(),
  quotedprice: Joi.number().positive().required(),
});

// Middleware to Validate Requests
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ success: false, error: error.details[0].message });
  next();
};

// Routes
app.get("/getShopDetails", async (req, res, next) => {
  try {
    const shop = await Shop.findOne();
    if (!shop) return res.status(404).json({ success: false, error: "Shop not found" });
    res.json({ success: true, data: { name: shop.name, authlogoUrl: shop.authlogoUrl } });
  } catch (error) {
    next(error);
  }
});

app.post("/getUsersDetails", async (req, res, next) => {
  try {
    const { email, phone } = req.body;
    if (!email || !phone) {
      return res.status(400).json({ success: false, error: "Email and phone number are required" });
    }
    const phoneNumber = phone.replace("+91", "");
    const user = await User.findOne({ email, phonenumber: phoneNumber });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({ success: true, data: { name: user.name, phonenumber: user.phonenumber, email: user.email } });
  } catch (error) {
    next(error);
  }
});

app.post("/submitAariInput", upload.array("design"), validate(submitAariSchema), async (req, res, next) => {
  try {
    const { orderid, name, phonenumber, submissiondate, deliverydate, address, additionalinformation, staffname, worktype, quotedprice } = req.body;
    const designURLs = [];

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file) => {
        const uniqueFilename = `${uuidv4()}.${file.originalname.split(".").pop()}`;
        const params = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `Aari/${uniqueFilename}`,
          Body: file.buffer,
          ContentType: file.mimetype,
        };
        await s3.send(new PutObjectCommand(params));
        return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/Aari/${uniqueFilename}`;
      });
      designURLs.push(...(await Promise.all(uploadPromises)));
    } else {
      return res.status(400).json({ success: false, error: "At least one design file is required" });
    }

    const newAariEntry = new Aari({
      orderid,
      name,
      phonenumber,
      submissiondate,
      deliverydate,
      address,
      additionalinformation: additionalinformation || undefined, 
      staffname,
      worktype,
      design: designURLs,
      status: STATUS.PENDING,
      quotedprice: Number(quotedprice), 
    });

    await newAariEntry.save();
    res.status(201).json({ success: true, message: "Aari input submitted successfully", orderid });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: "Order ID already exists" });
    }
    next(error);
  }
});

app.get("/getAariBendingPending", async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query; // Pagination
    const pendingOrders = await Aari.find({ status: STATUS.PENDING })
      .select("name design status orderid address deliverydate workerprice")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.status(200).json({ success: true, data: pendingOrders });
  } catch (error) {
    next(error);
  }
});

app.delete("/deleteAariBendingOrder/:orderid", async (req, res, next) => {
  try {
    const { orderid } = req.params;
    const deletedOrder = await Aari.findOneAndDelete({ orderid });
    if (!deletedOrder) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    logger.info(`Order ${orderid} deleted successfully`);
    res.status(200).json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    next(error);
  }
});

app.get("/getDesignUrl/:orderid", async (req, res, next) => {
  try {
    const { orderid } = req.params;
    const order = await Aari.findOne({ orderid }).select("design");
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    res.status(200).json({ success: true, design: order.design[0] }); // Return first design URL
  } catch (error) {
    next(error);
  }
});

app.get("/getAariBendingCompleted", async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query; // Pagination
    const completedOrders = await Aari.find({ status: STATUS.COMPLETED })
      .select("orderid name phonenumber design status updatedAt clientprice workerprice")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const formattedOrders = completedOrders.map((order) => ({
      orderid: order.orderid,
      name: order.name,
      phonenumber: order.phonenumber,
      design: order.design,
      status: order.status,
      completedDate: order.updatedAt.toLocaleDateString("en-GB"),
      clientprice: order.clientprice,
      workerprice: order.workerprice,
    }));
    res.status(200).json({ success: true, data: formattedOrders });
  } catch (error) {
    next(error);
  }
});

app.put("/updateAariBendingStatus/:orderid", async (req, res, next) => {
  try {
    const { orderid } = req.params;
    const { workerprice } = req.body;

    // Validate workerprice
    if (!workerprice || typeof workerprice !== "number" || workerprice <= 0) {
      return res.status(400).json({ success: false, error: "Worker price must be a positive number" });
    }

    const updateFields = {
      status: STATUS.COMPLETED,
      completeddate: new Date(),
      updatedAt: new Date(),
      workerprice, // Set workerprice from the request body
    };

    const updatedOrder = await Aari.findOneAndUpdate(
      { orderid },
      updateFields,
      { new: true }
    );

    if (!updatedOrder) return res.status(404).json({ success: false, error: "Order not found" });

    logger.info(`Order ${orderid} marked as completed with workerprice ${workerprice}`);
    res.status(200).json({ success: true, message: "Status and worker price updated successfully", data: updatedOrder });
  } catch (error) {
    next(error);
  }
});

app.put("/updateClientPriceByPhone/:phonenumber", async (req, res, next) => {
  try {
    const { phonenumber } = req.params;
    const { clientprice } = req.body;
    if (!clientprice || typeof clientprice !== "number" || clientprice <= 0) {
      return res.status(400).json({ success: false, error: "Client price must be a positive number" });
    }
    const updatedOrder = await Aari.findOneAndUpdate(
      { phonenumber },
      { clientprice, updatedAt: new Date() },
      { new: true, sort: { createdAt: -1 } }
    );
    if (!updatedOrder) {
      return res.status(404).json({ success: false, error: "No order found for this phone number" });
    }
    res.status(200).json({ success: true, message: "Client price updated successfully", data: updatedOrder });
  } catch (error) {
    next(error);
  }
});


// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(`${req.method} ${req.url} - Error: ${err.message}`, { stack: err.stack });
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: err.message });
  }
  res.status(500).json({ success: false, error: "Internal Server Error" });
});

// Start Server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`Server is listening on port ${port}`);
});