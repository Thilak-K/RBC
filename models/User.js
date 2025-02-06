const mongoose = require("mongoose");

const UserSchema = new mongoose(
  {
    name: String,
    phonenumber: String,
    email: String,
  },
  { collection: "Users" }
);

const User = mongoose.model("Users", UserSchema);
module.exports = UserSchema;
