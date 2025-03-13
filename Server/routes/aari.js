const express = require("express");
const router = express.Router();
const Joi = require("joi");
const multer = require("multer");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const Aari = require("../models/aari");
const logger = require("../utils/logger");
const s3 = require("../utils/s3");
const { STATUS, MULTER_LIMITS, ALLOWED_IMAGE_TYPES } = require("../config");
const { validate, sendError } = require("../middleware/validate");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: MULTER_LIMITS,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, JPEG, and PNG images are allowed"));
  },
});

// Validation Schema
const submitAariSchema = Joi.object({
  customerId: Joi.string().required(),
  orderid: Joi.string().required(),
  name: Joi.string().required(),
  phonenumber: Joi.string().pattern(/^\+91[6-9]\d{9}$/).required(),
  submissiondate: Joi.date().iso().required(),
  deliverydate: Joi.date().iso().greater(Joi.ref("submissiondate")).required(),
  address: Joi.string().required(),
  additionalinformation: Joi.string().allow(""),
  staffname: Joi.string().required(),
  worktype: Joi.string().valid("bridal", "normal").required(),
  quotedprice: Joi.number().positive().required(),
});

// Submit Aari Order
router.post("/submitAariInput", upload.array("design", 5), validate(submitAariSchema), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0)
      return sendError(res, 400, "At least one design file is required");

    const existingOrder = await Aari.findOne({ orderid: req.body.orderid });
    if (existingOrder) return sendError(res, 409, "Order ID already exists");

    const designURLs = await Promise.all(
      req.files.map(async (file, index) => {
        const uniqueFilename = `${uuidv4()}.${file.originalname.split(".").pop()}`;
        const params = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `Aari/${uniqueFilename}`,
          Body: file.buffer,
          ContentType: file.mimetype,
        };
        await s3.send(new PutObjectCommand(params));
        return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/Aari/${uniqueFilename}`;
      })
    );

    const newAariEntry = new Aari({
      ...req.body,
      designs: designURLs,
      status: "pending",
      quotedprice: Number(req.body.quotedprice),
    });

    await newAariEntry.save();
    logger.info(`Aari order ${req.body.orderid} saved successfully`);
    res.status(201).json({ success: true, message: "Aari input submitted successfully", orderid: req.body.orderid });
  } catch (error) {
    next(error);
  }
});
// Get Pending Aari Orders
router.get("/getAariPending", async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pendingOrders = await Aari.find({ status: STATUS.PENDING })
      .select("name designs status orderid address deliverydate workerprice worktype")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const mappedOrders = pendingOrders.map(order => ({
      orderid: order.orderid,
      name: order.name,
      designs: order.designs, 
      status: order.status,
      deliverydate: order.deliverydate.toISOString().split('T')[0],
      address: order.address,
      workerprice: order.workerprice,
      worktype: order.worktype,
    }));
    res.status(200).json({ success: true, data: mappedOrders });
  } catch (error) {
    next(error);
  }
});

// Aari Completed
router.get("/getAariCompleted", async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const completedOrders = await Aari.find({ status: STATUS.COMPLETED })
      .select("orderid name phonenumber designs status completeddate")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ completeddate: -1 });
    const mappedOrders = completedOrders.map(order => ({
      orderid: order.orderid,
      name: order.name,
      phonenumber: order.phonenumber,
      design: order.designs.length > 0 ? order.designs[0] : '',
      status: order.status,
      completedDate: order.completeddate ? order.completeddate.toISOString().split('T')[0] : '',
    }));
    res.status(200).json({ success: true, data: mappedOrders });
  } catch (error) {
    next(error);
  }
});
// Delete Aari Pending Order
router.delete("/deleteAariPendingOrder/:orderid", async (req, res, next) => {
  try {
    const { orderid } = req.params;
    const deletedOrder = await Aari.findOneAndDelete({ orderid });
    if (!deletedOrder) return sendError(res, 404, "Order not found");
    logger.info(`Order ${orderid} deleted successfully`);
    res.status(200).json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// Get Design URLs by Order ID
router.get("/getDesignUrl/:orderid", async (req, res, next) => {
  try {
    const order = await Aari.findOne({ orderid: req.params.orderid });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.status(200).json({ success: true, designs: order.designs });
  } catch (error) {
    next(error);
  }
});

// Update Aari Order Status to Completed
router.put("/updateAariPendingStatus/:orderid", async (req, res, next) => {
  try {
    const { orderid } = req.params;
    const { workerprice } = req.body;

    if (!workerprice || typeof workerprice !== "number" || workerprice <= 0) {
      return sendError(res, 400, "Worker price must be a positive number");
    }

    const updatedOrder = await Aari.findOneAndUpdate(
      { orderid },
      { status: STATUS.COMPLETED, completeddate: new Date(), workerprice },
      { new: true }
    );

    if (!updatedOrder) return sendError(res, 404, "Order not found");

    logger.info(`Order ${orderid} marked as completed`);
    res.status(200).json({ success: true, message: "Order updated successfully", data: updatedOrder });
  } catch (error) {
    next(error);
  }
});

// Update Client Price by Phone Number and Order ID
router.put("/updateClientPrice", async (req, res, next) => {
  try {
    const { phonenumber, orderid, clientprice } = req.body;

    if (!phonenumber || !orderid || !clientprice || typeof clientprice !== "number" || clientprice <= 0) {
      return sendError(res, 400, "Invalid input. Client price must be a positive number.");
    }

    const updatedOrder = await Aari.findOneAndUpdate(
      { phonenumber, orderid },
      { clientprice, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedOrder) return sendError(res, 404, "Order not found");

    res.status(200).json({ success: true, message: "Client price updated successfully", data: updatedOrder });
  } catch (error) {
    next(error);
  }
});


module.exports = router;
