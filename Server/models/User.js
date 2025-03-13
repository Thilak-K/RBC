const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "User name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    phonenumber: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      match: [/^\+91[6-9]\d{9}$/, "Phone number must be in +91XXXXXXXXXX format"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please enter a valid email address",
      ],
    },
  },
  { 
    collection: "User", // Use singular naming for consistency
    timestamps: true, // Adds createdAt & updatedAt fields automatically
  }
);

// Middleware to enforce phone number format before saving
UserSchema.pre("save", function (next) {
  if (!this.phonenumber.startsWith("+91")) {
    this.phonenumber = `+91${this.phonenumber}`;
  }
  next();
});

const User = mongoose.model("User", UserSchema);
module.exports = User;
