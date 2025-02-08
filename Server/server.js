require("dotenv").config(); // Load .env variables

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const bodyParser = require("body-parser");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB Connection
const MONGO = process.env.MONGO;

mongoose
  .connect(MONGO, {})
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    console.error("MongoDB Connection Error:", err);
    process.exit(1); // Exit the process if MongoDB connection fails
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

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
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
    return res.status(400).json({ error: err.message });
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
      additionalinformation,
    } = req.body;

    console.log("Request Body:", req.body); 
    console.log("Request File:", req.file); 

    let designURL = null;

    if (req.file) {
      const file = req.file;
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const fileName = `design-${uniqueSuffix}.${file.originalname.split(".").pop()}`;

      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `/Aari/${fileName}`,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: "public-read",
      };
      const command = new PutObjectCommand(params);
      await s3.send(command);
      designURL = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/Aari/${fileName}`;
      console.log("Design URL:", designURL); 
    }

    if (!designURL) {
      return res.status(400).json({ error: "Failed to upload design" });
    }

    const newAariEntry = new Aari({
      orderid: orderid.replace(/"/g, ""),
      name: name.replace(/"/g, ""),
      phonenumber: phonenumber.replace(/"/g, ""),
      submissiondate: submissiondate.replace(/"/g, ""),
      deliveryDate: deliveryDate.replace(/"/g, ""), // Ensure consistent naming
      additionalinformation: additionalinformation.replace(/"/g, ""),
      design: designURL,
    });

    console.log("New Aari Entry:", newAariEntry); 

    await newAariEntry.save();
    res
      .status(201)
      .json({ message: "Aari input submitted successfully", orderId: orderid });
  } catch (error) {
    console.error("Error submitting Aari input:", error);
    res.status(500).json({ error: "Failed to submit Aari input" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is Listening on port ${port}`);
});
