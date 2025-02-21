require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const app = express();




// Environment Variable Validation
const requiredEnvVars = [
  "MONGO",
  "AWS_REGION",
  "KEY_ID",
  "ACCESS_KEY",
  "S3_BUCKET_NAME",
  "PORT",
];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Missing environment variable: ${varName}`);
    process.exit(1);
  }
});

app.use(cors({ origin: true }));
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO, {})
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    console.error("MongoDB Connection Error:", err);
    process.exit(1);
  });

// AWS Configuration
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.KEY_ID,
    secretAccessKey: process.env.ACCESS_KEY,
  },
});

// Import Models
const Shop = require("./models/Shop");
const User = require("./models/User");
const Aari = require("./models/Aari");

// Multer Configuration (Memory storage for S3 upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, JPEG, and PNG images are allowed."));
    }
  },
});

// Error Handling Middleware for Multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: err.message });
  } else if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
});

// API Endpoints

app.get("/getShopDetails", async (req, res) => {
  try {
    const shop = await Shop.findOne();
    if (!shop) {
      return res.status(404).json({ success: false, error: "Shop not found" });
    }
    res.json({
      success: true,
      data: { name: shop.name, authlogoUrl: shop.authlogoUrl },
    });
  } catch (error) {
    console.error("Error fetching shop details:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.post("/getUsersDetails", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({
      success: true,
      data: { name: user.name, phonenumber: user.phonenumber, email: user.email },
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.post("/submitAariInput", upload.array("design"), async (req, res) => {
  try {
    const {
      orderid,
      name,
      phonenumber,
      submissiondate,
      deliverydate,
      address,
      additionalinformation,
      staffname,
    } = req.body;

    // Check for required fields
    if (!orderid || !name || !phonenumber || !submissiondate || !deliverydate || !address || !staffname) {
      return res.status(400).json({ success: false, error: "All fields are required" });
    }

    // Process multiple design files
    const designURLs = [];
    if (req.files && req.files.length > 0) {
      const files = req.files; // Array of files from multer
      for (const file of files) {
        const uniqueFilename = `${uuidv4()}.${file.originalname.split(".").pop()}`;
        const params = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `Aari/${uniqueFilename}`,
          Body: file.buffer,
          ContentType: file.mimetype,
        };

        const command = new PutObjectCommand(params);
        await s3.send(command); // Upload to S3

        const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/Aari/${uniqueFilename}`;
        designURLs.push(url);
      }
    } else {
      return res.status(400).json({ success: false, error: "At least one design file is required" });
    }

    const newAariEntry = new Aari({
      orderid,
      name,
      phonenumber,
      submissiondate: new Date(submissiondate),
      deliverydate: new Date(deliverydate),
      address,
      additionalinformation,
      staffname,
      design: designURLs, // Array of S3 URLs
    });

    await newAariEntry.save();
    res.status(201).json({
      success: true,
      message: "Aari input submitted successfully",
      orderid,
    });
  } catch (error) {
    console.error("Error submitting Aari input:", error);
    if (error.name === "ValidationError") {
      res.status(400).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: "Failed to submit Aari input" });
    }
  }
});

app.get("/getAariBendingPending", async (req, res) => {
  try {
    const pendingOrders = await Aari.find({ status: "pending" }, "name design status orderid");
    res.status(200).json({ success: true, data: pendingOrders });
  } catch (error) {
    console.error("Error fetching pending Aari orders:", error);
    res.status(500).json({ success: false, error: "Failed to fetch pending orders" });
  }
});

app.get("/getAariBendingCompleted", async (req, res) => {
  try {
    const completedOrders = await Aari.find({ status: "completed" }, "name design status");
    res.status(200).json({ success: true, data: completedOrders });
  } catch (error) {
    console.error("Error fetching completed Aari orders:", error);
    res.status(500).json({ success: false, error: "Failed to fetch completed orders" });
  }
});

app.put("/updateAariBendingStatus/:orderid", async (req, res) => {
  try {
    const { orderid } = req.params;

    const updatedOrder = await Aari.findOneAndUpdate(
      { orderid },
      { status: "Completed" },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating Aari status:", error);
    res.status(500).json({ success: false, error: "Failed to update status" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});