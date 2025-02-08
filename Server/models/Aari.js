const mongoose = require("mongoose");

const AariinputSchema = new mongoose.Schema({
    orderid: { type: String, required: true, unique: true }, 
    name: { type: String, required: true },
    phonenumber: { type: String, required: true },
    submissiondate: { type: Date, required: true }, 
    deliverydate: { type: Date, required: true },   
    additionalinformation: String,
    design: String, // URL of the design
}, { 
    collection: "Aari",
    timestamps: true  
});

const Aari = mongoose.model("Aari", AariinputSchema);
module.exports = Aari;