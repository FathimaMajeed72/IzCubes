const mongoose = require("mongoose");
const {Schema} = mongoose;
const {v4:uuidv4} = require('uuid')

const orderSchema = new Schema({
    orderId : {
        type : String,
        default : ()=>uuidv4(),
        unique : true
    },
    user: {
         type: mongoose.Schema.Types.ObjectId, 
         ref: 'User',
         required: true 
    },
    orderedItems : [{
        product : {
            type : Schema.Types.ObjectId,
            ref : "Product",
            required : true
        },
        size: {
            type: String,
            required: true
        },
        quantity : {
            type : Number,
            required : true
        },
        price : {
            type : Number,
            default : 0
        },
        status: {
             type: String, 
             enum: ['Confirmed', 'Cancelled', 'Returned'],
             default: "Confirmed" 
        },
        cancelReason: {
            type: String,
            default: ""
        },
        returnReason: {
            type: String,
            default: ""
        },
        returnStatus: {
            type: String,
            enum: ['NotRequested', 'Pending', 'Accepted', 'Rejected'],
            default: 'NotRequested'
        },
        stockUpdated: {
            type: Boolean,
            default: false 
        }
    }],
    totalPrice : {
        type : Number,
        required : true
    }, 
    discount : {
        type : Number,
        default : 0
    },
    finalAmount : {
        type : Number,
        required : true
    },
    couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon',
        default: null
    },
    couponDiscount: {
        type: Number,
        default: 0
    },
    address: {
        addressType: String,
        name: String,
        houseName: String,
        streetName: String,
        landMark: String,
        city: String,
        pincode: Number,
        state: String,
        phone: String,
        altPhone: String
    },
    paymentMethod : {
        type : String,
        enum : ['COD','Online','Wallet'],
        required : true
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Success", "Failed"],
        default: "Pending",
    },
    razorpayOrderId: {
        type:String,
    },
    paymentId: {
        type:String,
    },
    invoiceDate : {
        type : Date,
        default: Date.now
    },
    status : {
        type : String,
        required :true,
        enum : ['Pending','Processing','Shipped','Delivered','Cancelled','Return Request','Returned','Return Rejected',"Payment Failed"]
    },
    cancellationReason: {
        type: String,
        default: "" 
    },
    isReturnRequested: {
         type: Boolean, 
         default: false 
    },
    returnStatus: { 
        type: String, 
        enum: ["None", "Pending", "Accepted", "Rejected"], 
        default: "None" 
    },
    returnReason: {
        type: String,
        default: ""
    },
    createdOn : {
        type : Date,
        default : Date.now,
        required :true
    },
})

const Order = mongoose.model("Order",orderSchema);
module.exports = Order;