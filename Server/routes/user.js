const express = require("express");
const router = express.Router();
const User = require("../models/user");
const logger = require("../utils/logger");

router.post("/getUserDetails", async (req, res, next) => {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      return res.status(400).json({ success: false, error: "Email and phone number are required" });
    }

    // Ensure phone number is stored with +91
    const normalizedPhone = phone.startsWith("+91") ? phone : `+91${phone}`;

    const user = await User.findOne({
      email: email.toLowerCase(), // Ensure case-insensitive email matching
      phonenumber: { $in: [normalizedPhone, phone] }, // Match with or without +91
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.status(200).json({
      success: true,
      data: { name: user.name, phonenumber: user.phonenumber, email: user.email },
    });
  } catch (error) {
    logger.error("Error in /getUserDetails:", error);
    next(error);
  }
});

module.exports = router;
