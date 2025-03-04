const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema({
  customerId: {
    type: String,
    required: [true, "Customer ID is required"],
    unique: true,
    trim: true,
    default: mongoose.Types.ObjectId,
  },
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    maxlength: [100, "Name cannot exceed 100 characters"],
  },
  phoneNumber: {
    type: String,
    required: [true, "Phone number is required"],
    trim: true,
    match: [/^\+91-\d{10}$/, "Phone number must be in format +91-XXXXXXXXXX"],
    unique: true,
  },
  alternateNumber: {
    type: String,
    trim: true,
    match: [/^\+91-\d{10}$/, "Alternate number must be in format +91-XXXXXXXXXX"],
    sparse: true,
  },
  address: {
    type: String,
    required: [true, "Address is required"],
    trim: true,
    maxlength: [500, "Address cannot exceed 500 characters"],
  },
  town: {
    type: String,
    trim: true,
    maxlength: [100, "Town/Village cannot exceed 100 characters"],
  },
  district: {
    type: String,
    required: [true, "District is required"],
    trim: true,
    default: 'Dindigul',
  },
  state: {
    type: String,
    required: [true, "State is required"],
    trim: true,
    default: 'Tamil Nadu',
  },
  dateOfBirth: {
    type: String,
    required: [true, "Date of birth is required"],
    trim: true,
    match: [/^\d{2}\/\d{2}\/\d{4}$/, "Date of birth must be in DD/MM/YYYY format"],
  },
  maritalStatus: {
    type: String,
    required: [true, "Marital status is required"],
    trim: true,
    default: 'Single',
  },
}, {
  collection: "Customers",
  timestamps: true,
});

// Pre-save hook to handle alternateNumber
CustomerSchema.pre('save', function (next) {
  if (this.alternateNumber === '+91-') {
    this.alternateNumber = null;
  }
  next();
});

const Customer = mongoose.model("Customer", CustomerSchema);
module.exports = Customer;