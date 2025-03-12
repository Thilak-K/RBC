const express = require("express");
const router = express.Router();
const Shop = require("../models/Shop");
const logger = require("../utils/logger");
const redis = require("redis");
const { CACHE_TTL } = require("../config");

const client = redis.createClient({ url: process.env.REDIS_URL });
client.connect().catch((err) => logger.error("Redis connection error:", err));

router.get("/getShopDetails", async (req, res, next) => {
  try {
    const cachedShop = await client.get("shopDetails");
    if (cachedShop) return res.json(JSON.parse(cachedShop));

    const shop = await Shop.findOne();
    if (!shop) return res.status(404).json({ success: false, error: "Shop not found" });

    const response = { success: true, data: { name: shop.name, authlogoUrl: shop.authlogoUrl } };
    await client.setEx("shopDetails", CACHE_TTL, JSON.stringify(response));
    res.json(response);
  } catch (error) {
    next(error);
  }
});

module.exports = router;