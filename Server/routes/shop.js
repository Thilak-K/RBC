const express = require("express");
const router = express.Router();
const Shop = require("../models/shop");
const logger = require("../utils/logger");

// Fetch Shop Details
router.get("/getShopDetails", async (req, res, next) => {
  try {
    const shop = await Shop.findOne().lean(); // Ensures better performance
    if (!shop) return res.status(404).json({ success: false, error: "Shop not found" });

    res.json({
      success: true,
      data: {
        name: shop.name,
        authlogoUrl: shop.authlogoUrl || "", // Prevents undefined values
      },
    });
  } catch (error) {
    logger.error("Error fetching shop details:", error);
    next(error);
  }
});

module.exports = router;
