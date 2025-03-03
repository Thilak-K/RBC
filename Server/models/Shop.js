const mongoose = require("mongoose");

const ShopSchema = new mongoose.Schema(
  {
    name: String,
    logourl: String,
    authlogoUrl: String,
  },
  { collection: "ShopName" }
);

const Shop = mongoose.model("Shop", ShopSchema);
module.exports = Shop;
