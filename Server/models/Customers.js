const mongoose = require("mongoose");
const { STATUS } = require("../config"); // Import STATUS from config.js

const AariSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: [true, "Customer ID is required"],
      trim: true,
      ref: "Customers", // Reference to the Customers collection
    },
    orderid: {
      type: String,
      required: [true, "Order ID is required"],
      unique: true,
      trim: true,
      index: true, // Add index for faster lookups
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    phonenumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^\+91-\d{10}$/, "Phone number must be in format +91-XXXXXXXXXX"],
      index: true, // Add index for queries by phone number
    },
    submissiondate: {
      type: Date,
      required: [true, "Submission date is required"],
      index: true, // Index for sorting/filtering by date
    },
    deliverydate: {
      type: Date,
      required: [true, "Delivery date is required"],
      validate: {
        validator: function (value) {
          return this.submissiondate < value;
        },
        message: "Delivery date must be after submission date",
      },
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
      maxlength: [500, "Address cannot exceed 500 characters"],
    },
    additionalinformation: {
      type: String,
      trim: true,
      maxlength: [1000, "Additional information cannot exceed 1000 characters"],
    },
    designs: {
      type: [String], // Array of design URLs instead of design1, design2, etc.
      required: [true, "At least one design URL is required"],
      validate: {
        validator: (arr) => arr.length > 0 && arr.length <= 5,
        message: "Designs must have between 1 and 5 URLs",
      },
    },
    worktype: {
      type: String,
      required: [true, "Work type is required"],
      enum: ["bridal", "normal"], // Restrict to specific values
      trim: true,
      lowercase: true,
    },
    staffname: {
      type: String,
      required: [true, "Staff name is required"],
      trim: true,
      maxlength: [50, "Staff name cannot exceed 50 characters"],
    },
    status: {
      type: String,
      enum: Object.values(STATUS), // Use STATUS from config
      default: STATUS.PENDING,
      lowercase: true,
      index: true, // Index for filtering by status
    },
    quotedprice: {
      type: Number,
      required: [true, "Quoted price is required"],
      min: [0, "Quoted price cannot be negative"],
    },
    workerprice: {
      type: Number,
      default: null,
      min: [0, "Worker price cannot be negative"],
    },
    clientprice: {
      type: Number,
      default: null,
      min: [0, "Client price cannot be negative"],
    },
    completeddate: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "Aari",
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

// Indexes for common queries
AariSchema.index({ customerId: 1 });
AariSchema.index({ submissiondate: 1, status: 1 }); // Compound index for sorting pending orders

// Pre-save hook to set completeddate
AariSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === STATUS.COMPLETED && !this.completeddate) {
    this.completeddate = new Date();
  }
  next();
});

// Virtual to maintain backward compatibility with design1, design2, etc.
AariSchema.virtual("design1").get(function () {
  return this.designs[0] || null;
});
AariSchema.virtual("design2").get(function () {
  return this.designs[1] || null;
});
AariSchema.virtual("design3").get(function () {
  return this.designs[2] || null;
});
AariSchema.virtual("design4").get(function () {
  return this.designs[3] || null;
});
AariSchema.virtual("design5").get(function () {
  return this.designs[4] || null;
});

// Ensure virtuals are included in toJSON and toObject
AariSchema.set("toJSON", { virtuals: true });
AariSchema.set("toObject", { virtuals: true });

const Aari = mongoose.model("Aari", AariSchema);
module.exports = Aari;