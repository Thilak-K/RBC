const express = require("express");
const router = express.Router();
const Joi = require("joi");
const multer = require("multer");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const Aari = require("../models/Aari");
const logger = require("../utils/logger");
const s3 = require("../utils/s3");
const { STATUS, MULTER_LIMITS, ALLOWED_IMAGE_TYPES } = require("../config");
const { validate, sendError } = require("../middleware/validate");
const { authenticateToken } = require("../middleware/auth");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: MULTER_LIMITS,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, JPEG, and PNG images are allowed"));
  },
});

const submitAariSchema = Joi.object({
    customerId: Joi.string().required(),
    orderid: Joi.string().required(),
    name: Joi.string().required(),
    phonenumber: Joi.string().required(),
    submissiondate: Joi.date().iso().required(),
    deliverydate: Joi.date().iso().required(),
    address: Joi.string().required(),
    additionalinformation: Joi.string().allow(""),
    staffname: Joi.string().required(),
    worktype: Joi.string().valid("bridal", "normal").required(),
    quotedprice: Joi.number().positive().required(),
  });

router.post(
    "/submitAariInput",
    authenticateToken,
    upload.array("design", 5),
    validate(submitAariSchema),
    async (req, res, next) => {
      try {
        if (!req.files || req.files.length === 0) return sendError(res, 400, "At least one design file is required");
  
        const designURLs = await Promise.all(
          req.files.map(async (file) => {
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
          status: STATUS.PENDING,
          quotedprice: Number(req.body.quotedprice),
        });
  
        await newAariEntry.save();
        logger.info(`Aari order ${req.body.orderid} saved successfully with ${designURLs.length} designs`);
        res.status(201).json({ success: true, message: "Aari input submitted successfully", orderid: req.body.orderid });
      } catch (error) {
        if (error.name === "ValidationError") return sendError(res, 400, error.message);
        if (error.code === 11000) return sendError(res, 409, "Order ID already exists");
        next(error);
      }
    }
  );

router.get("/getAariPending", async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pendingOrders = await Aari.find({ status: STATUS.PENDING })
      .select("name design status orderid address deliverydate workerprice worktype")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.status(200).json({ success: true, data: pendingOrders });
  } catch (error) {
    next(error);
  }
});

router.delete("/deleteAariPendingOrder/:orderid", authenticateToken, async (req, res, next) => {
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

router.get("/getDesignUrl/:orderid", async (req, res, next) => {
    try {
      const { orderid } = req.params;
      const order = await Aari.findOne({ orderid }).select("designs");
      if (!order) return sendError(res, 404, "Order not found");
  
      const designs = order.designs;
      if (designs.length === 0) return sendError(res, 404, "No design URLs found for this order");
  
      res.status(200).json({ success: true, designs });
    } catch (error) {
      next(error);
    }
  });

router.get("/getAariCompleted", async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
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

router.put("/updateAariPendingStatus/:orderid", authenticateToken, async (req, res, next) => {
  try {
    const { orderid } = req.params;
    const { workerprice } = req.body;

    if (!workerprice || typeof workerprice !== "number" || workerprice <= 0) {
      return sendError(res, 400, "Worker price must be a positive number");
    }

    const updatedOrder = await Aari.findOneAndUpdate(
      { orderid },
      { status: STATUS.COMPLETED, completeddate: new Date(), updatedAt: new Date(), workerprice },
      { new: true }
    );

    if (!updatedOrder) return sendError(res, 404, "Order not found");

    logger.info(`Order ${orderid} marked as completed with workerprice ${workerprice}`);
    res.status(200).json({ success: true, message: "Status and worker price updated successfully", data: updatedOrder });
  } catch (error) {
    next(error);
  }
});

router.put("/updateClientPriceByPhone/:phonenumber", authenticateToken, async (req, res, next) => {
  try {
    const { phonenumber } = req.params;
    const { clientprice } = req.body;

    if (!clientprice || typeof clientprice !== "number" || clientprice <= 0) {
      return sendError(res, 400, "Client price must be a positive number");
    }

    const updatedOrder = await Aari.findOneAndUpdate(
      { phonenumber },
      { clientprice, updatedAt: new Date() },
      { new: true, sort: { createdAt: -1 } }
    );

    if (!updatedOrder) return sendError(res, 404, "No order found for this phone number");

    res.status(200).json({ success: true, message: "Client price updated successfully", data: updatedOrder });
  } catch (error) {
    next(error);
  }
});

module.exports = router;