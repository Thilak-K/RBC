const mongoose = require("mongoose");

const AariinputSchema = new mongoose.Schema({
    orderid:String,
    name:String,
    phonenumber:String,
    submissiondate:String,
    deliveryDate:String,
    additionalinformation:String,
    design:String,
},{collection:"Aari"});

const Aari = mongoose.model("Aari", AariinputSchema);
module.exports= Aari;