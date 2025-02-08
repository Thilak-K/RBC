require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { body, validationResult } = require('express-validator'); // For input validation
const { v4: uuidv4 } = require('uuid'); //For generating unique file names
const app = express();


// Environment Variable Validation
const requiredEnvVars = ["MONGO", "AWS_REGION", "KEY_ID", "ACCESS_KEY", "S3_BUCKET_NAME", "PORT"];
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.error(`Missing environment variable: ${varName}`);
        process.exit(1);
    }
});

app.use(cors({ origin: true }));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO, {})
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


app.post("/submitAariInput", [
    body('orderid').notEmpty().withMessage('Order ID is required'),
    body('name').notEmpty().withMessage('Name is required'),
    body('phonenumber').notEmpty().withMessage('Phone number is required'),
    body('submissiondate').notEmpty().withMessage('Submission date is required'),
    body('deliverydate').notEmpty().withMessage('Delivery date is required'),
    // Add more validations as needed (e.g., email format, phone number format)
], upload.single("design"), async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            orderid,
            name,
            phonenumber,
            submissiondate,
            deliverydate,
            additionalinformation,
        } = req.body;

        let designURL = null;

        if (req.file) {
            const file = req.file;
            const uniqueFilename = `${uuidv4()}.${file.originalname.split('.').pop()}`; // Unique filename
            const params = {
                Bucket: process.env.S3_BUCKET_NAME,
                Key: `/Aari/${uniqueFilename}`, // Include directory in key
                Body: file.buffer,
                ContentType: file.mimetype,
            };

            const command = new PutObjectCommand(params);
            const s3Response = await s3.send(command);

            designURL = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/Aari/${uniqueFilename}`;
            console.log("Design URL:", designURL);
        } else {
          return res.status(400).json({ error: "Design file is required" });
        }

        const newAariEntry = new Aari({
            orderid,
            name,
            phonenumber,
            submissiondate,
            deliverydate,
            additionalinformation,
            design: designURL,
        });

        await newAariEntry.save();
        res.status(201).json({ message: "Aari input submitted successfully", orderId: orderid });

    } catch (error) {
        console.error("Error submitting Aari input:", error);
        if (error.name === 'ValidationError') {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: "Failed to submit Aari input" });
        }
    }
});



const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is Listening on port ${port}`);
});