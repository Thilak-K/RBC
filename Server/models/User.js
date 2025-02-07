const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: String,
    phonenumber: String,
    email: String,
  },
  { collection: "Users" }
);

const User = mongoose.model("Users", UserSchema);
module.exports = User;
