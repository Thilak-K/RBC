const express = require("express");
const router = express.Router();
const User = require("../models/User");
const logger = require("../utils/logger");

router.post("/getUsersDetails", async (req, res, next) => {
  try {
    const { email, phone } = req.body;
    if (!email || !phone) return res.status(400).json({ success: false, error: "Email and phone number are required" });

    const phoneNumber = phone.replace("+91", ""); // Consider using libphonenumber-js for better handling
    const user = await User.findOne({ email, phonenumber: phoneNumber });
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    res.json({
      success: true,
      data: { name: user.name, phonenumber: user.phonenumber, email: user.email },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;