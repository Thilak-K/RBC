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

// Multer configuration (Memory storage for now - consider streaming for large files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, JPEG, and PNG images are allowed."));
    }
  },
});

// Error handling for Multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message }); // Or a more specific message
  }
  next();
});

// API Endpoints

app.get("/getShopDetails", async (req, res) => {
  try {
    const shop = await Shop.findOne();
    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }
    res.json({
      name: shop.name,
      authlogoUrl: shop.authlogoUrl,
    });
  } catch (error) {
    console.error("Error fetching shop details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/getUsersDetails", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      name: user.name,
      phonenumber: user.phonenumber,
      email: user.email,
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/submitAariInput", upload.single("design"), async (req, res) => {
  try {
    const {
      orderid,
      name,
      phonenumber,
      submissiondate,
      deliverydate,
      address,
      additionalinformation,
    } = req.body;

    let designURL = null;

    if (req.file) {
      const file = req.file;
      const uniqueFilename = `${uuidv4()}.${file.originalname
        .split(".")
        .pop()}`; // Unique filename
      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `/Aari/${uniqueFilename}`,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      const command = new PutObjectCommand(params);


      designURL = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/Aari/${uniqueFilename}`;
    } else {
      return res.status(400).json({ error: "Design file is required" });
    }
    const newAariEntry = new Aari({
      orderid,
      name,
      phonenumber,
      submissiondate,
      deliverydate,
      address,
      additionalinformation,
      design: designURL,
    });

    await newAariEntry.save();
    res
      .status(201)
      .json({ message: "Aari input submitted successfully", orderId: orderid });
  } catch (error) {
    console.error("Error submitting Aari input:", error);
    if (error.name === "ValidationError") {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Failed to submit Aari input" });
    }
  }
});

app.get("/getAariBendingPending", async (req, res)=>{
  try{
    const pendingOrders = await AariBending.find(
      {satus:"pending"},
      "name design status"
    );
    res.status(200).json(pendingOrders);
  }catch(error){
    console.log("Error fetching pending AariBending orders");
    res.status(500).json({ error: "Failed to fetch pending orders" });
  }
});

app.put("/updateAariBendingStatus/:orderid", async (req, res) => {
  try {
    const { orderid } = req.params;

    // Update the status to "Completed"
    const updatedOrder = await AariBending.findOneAndUpdate(
      { orderid: orderid }, 
      { status: "Completed" }, 
      { new: true } 
    );

    if (!updatedOrder) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json({ message: "Status updated successfully", updatedOrder });
  } catch (error) {
    console.error("Error updating AariBending status:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is Listening on port ${port}`);
});
