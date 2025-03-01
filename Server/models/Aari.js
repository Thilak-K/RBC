const mongoose = require("mongoose");

const AariSchema = new mongoose.Schema({
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
    match: [/^\+91-\d{10}$/, "Phone number must be in format +91-XXXXXXXXXX"],
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
  design: [{
    type: String,
    trim: true,
  }],
  staffname: {
    type: String,
    required: [true, "Staff name is required"],
    trim: true,
  },
  status: {
    type: String,
    enum: ["pending", "completed"], // Restrict to specific values
    default: "pending",
    lowercase: true, // Ensure consistency
  },
  quotedprice: {
    type: Number,
    required: [true, "Quoted price is required"],
    min: [0, "Quoted price cannot be negative"],
  },
  workerprice: {
    type: Number,
    default: null, // Nullable
    min: [0, "Worker price cannot be negative"],
  },
  clientprice: {
    type: Number,
    default: null, // Nullable
    min: [0, "Client price cannot be negative"],
  },
  completeddate: {
    type: Date,
    default: null, // Nullable, set when status changes to "completed"
  },
}, {
  collection: "Aari",
  timestamps: true, // Adds createdAt and updatedAt
});

// Middleware to set completeddate when status changes to "completed"
AariSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === "completed" && !this.completeddate) {
    this.completeddate = new Date();
  }
  next();
});

const Aari = mongoose.model("Aari", AariSchema);
module.exports = Aari;