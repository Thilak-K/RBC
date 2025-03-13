const express = require("express");
const router = express.Router();
const Joi = require("joi");
const Customer = require("../models/customers");
const logger = require("../utils/logger");
const { validate, sendError } = require("../middleware/validate");

// Customer Schema Validation
const customerSchema = Joi.object({
  customerId: Joi.string()
    .pattern(/^CUST-[a-zA-Z0-9]{12}$/)
    .required()
    .messages({
      "string.pattern.base": "Customer ID must follow format CUST- followed by 12 alphanumeric characters",
    }),
  name: Joi.string().min(2).max(100).required(),
  phonenumber: Joi.string()
    .pattern(/^\+91[6-9]\d{9}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be in +91XXXXXXXXXX format and start with 6-9",
    }),
  address: Joi.string().min(5).max(500).required(),
  town: Joi.string().min(2).max(100).optional().allow(""),
  district: Joi.string().max(100).default("Dindigul"),
  state: Joi.string().max(100).default("Tamil Nadu"),
  maritalStatus: Joi.string().max(50).default("Married"),
});

// Add New Customer
router.post("/submitCustomers", validate(customerSchema), async (req, res, next) => {
  try {
    const { customerId, phonenumber } = req.body;

    // Check for existing customer ID
    const existingCustomer = await Customer.findOne({ customerId });
    if (existingCustomer) return sendError(res, 409, "Customer ID already exists");

    // Check for duplicate phone number
    const existingPhone = await Customer.findOne({ phonenumber });
    if (existingPhone) return sendError(res, 409, "Phone number already exists");

    // Create new customer
    const newCustomer = new Customer(req.body);
    await newCustomer.save();

    logger.info(`Customer ${newCustomer.customerId} saved successfully`);
    res.status(201).json({
      success: true,
      message: "Customer saved successfully",
      customerId: newCustomer.customerId,
      createdAt: newCustomer.createdAt,
      updatedAt: newCustomer.updatedAt,
    });
  } catch (error) {
    logger.error("Error in /submitCustomers:", error);
    if (error.name === "ValidationError") return sendError(res, 400, error.message);
    next(error);
  }
});

module.exports = router;
