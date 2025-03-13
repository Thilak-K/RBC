const mongoose = require("mongoose");

const AariSchema = new mongoose.Schema({
  customerId: { 
    type: String,
    required: [true, "Customer ID is required"],
    trim: true,
    ref: "Customers",
  },
  orderid: {
    type: String,
    required: [true, "Order ID is required"],
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
  },
  phonenumber: {
    type: String,
    required: [true, "Phone number is required"],
    trim: true,
    match: [/^\+91[6-9]\d{9}$/, "Phone number must be in format +91XXXXXXXXXX starting with 6-9"],
  },
  submissiondate: {
    type: Date,
    required: [true, "Submission date is required"],
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
  },
  additionalinformation: {
    type: String,
    trim: true,
  },
  designs: {
    type: [String],  // Store all design URLs in an array
    validate: {
      validator: function (designs) {
        return designs.length > 0 && designs.length <= 5;
      },
      message: "At least one design is required, max 5 allowed.",
    },
  },
  worktype: {
    type: String,
    required: [true, "Work type (bridal or normal) is required"],
    trim: true,
    lowercase: true,
    enum: ["bridal", "normal"],
  },
  staffname: {
    type: String,
    required: [true, "Staff name is required"],
    trim: true,
  },
  status: {
    type: String,
    enum: ["pending", "completed"],
    default: "pending",
    lowercase: true,
  },
  quotedprice: {
    type: Number,
    required: [true, "Quoted price is required"],
    min: [1, "Quoted price must be positive"],
  },
  workerprice: {
    type: Number,
    default: null,
    min: [1, "Worker price must be positive"],
  },
  clientprice: {
    type: Number,
    default: null,
    min: [1, "Client price must be positive"],
  },
  completeddate: {
    type: Date,
    default: null,
  },
  updatedAt: {
    type: Date,
  },
}, {
  collection: "Aari",
  timestamps: true,
});

// Ensure `completeddate` is set when status changes to completed
AariSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (this.status === "completed" && !this.completeddate) {
      this.completeddate = new Date();
    }
    this.updatedAt = new Date();  
  }
  next();
});

const Aari = mongoose.model("Aari", AariSchema);
module.exports = Aari;
