const express = require("express");
const router = express.Router();
const Joi = require("joi");
const Customer = require("../models/Customer");
const logger = require("../utils/logger");
const { validate, sendError } = require("../middleware/validate");

const customerSchema = Joi.object({
  customerId: Joi.string().required(),
  name: Joi.string().max(100).required(),
  phonenumber: Joi.string().required(),
  address: Joi.string().max(500).required(),
  town: Joi.string().max(100).allow(""),
  district: Joi.string().required(),
  state: Joi.string().required(),
  maritalStatus: Joi.string().required(),
});

router.post("/submitCustomers", validate(customerSchema), async (req, res, next) => {
  try {
    const newCustomer = new Customer(req.body);
    await newCustomer.save();
    logger.info(`Customer ${newCustomer.customerId} saved successfully`);
    res.status(201).json({
      success: true,
      message: "Customer saved successfully",
      customerId: newCustomer.customerId,
    });
  } catch (error) {
    logger.error("Error in /submitCustomers:", error);
    if (error.name === "ValidationError") return sendError(res, 400, error.message);
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      return sendError(res, 409, `${duplicateField} already exists`);
    }
    next(error);
  }
});

module.exports = router;