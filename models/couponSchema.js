const mongoose = require("mongoose");
const {Schema} = mongoose;


const couponSchema = new mongoose.Schema({
    name : {
        type : String,
        required : true,
        unique : true
    },
    createdOn : {
        type : Date,
        default : Date.now
    },
    expireOn : {
        type : Date,
        required : true
    },
    discountType: {
        type: String,
        enum: ['fixed', 'percentage'],
        default: 'fixed'
    },
    offerPrice : {
        type : Number,
        required : true
    },
    maxDiscountAmount: {
        type: Number,       
        default: null
    },
    minimumPrice : {
        type : Number,
        required : true
    },
    isList : {
        type : Boolean,
        default : true
    },
    usedBy : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "User"
    }],
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    type: {
        type: String,
        enum: ['referral', 'seasonal'],
        default: 'seasonal'
    }
})


const Coupon = mongoose.model("Coupon",couponSchema);

module.exports = Coupon;