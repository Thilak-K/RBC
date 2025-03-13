const mongoose = require("mongoose");

const ShopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Shop name is required"],
      trim: true,
      minlength: [2, "Shop name must be at least 2 characters long"],
      maxlength: [100, "Shop name cannot exceed 100 characters"],
      default: "My Shop", // Default value for shop name
    },
    logourl: {
      type: String,
      trim: true,
      match: [
        /^(https?:\/\/.*\.(png|jpg|jpeg|svg|webp|gif)(\?.*)?)$/,
        "Invalid logo URL format. Must be a valid image URL",
      ],
    },
    authlogoUrl: {
      type: String,
      trim: true,
      match: [
        /^(https?:\/\/.*\.(png|jpg|jpeg|svg|webp|gif)(\?.*)?)$/,
        "Invalid auth logo URL format. Must be a valid image URL",
      ],
    },
  },
  { 
    collection: "ShopName",
    timestamps: true, // Adds createdAt & updatedAt
  }
);

module.exports = mongoose.model("Shop", ShopSchema);
