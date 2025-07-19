const mongoose = require("mongoose");
const {Schema} = mongoose;


const userSchema = new Schema({
    name : {
        type : String,
        required : true
    },
    email : {
        type : String,
        required : true,
        unique : true
    },
    phone : {
        type : String,
        required : false,
        unique : true,
        sparse : true,
    },
    googleId : {
        type : String,
        unique : true,
        sparse : true
    },
    password : {
        type : String,
        required : false
    },
    profileImage: {
        type : String,
        default: "/img/defaultProfileImage.jpg"
    },
    isBlocked : {
        type : Boolean,
        default : false
    },
    isAdmin : {
        type : Boolean,
        default : false
    },
    cart : [{
        type : Schema.Types.ObjectId,
        ref : "Cart",
    }],
    wishlist : [{
        type : Schema.Types.ObjectId,
        ref : "Wishlist",
        default: []
    }],
    wallet: {
        balance: {
            type: Number,
            default: 0
        },
        transactions: [
            {
            type: { type: String },
            amount: Number,
            date: { type: Date, default: Date.now },
            reason: String,
            orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }
            }
        ]
    },
    referralCode: {
        type: String,
        unique: true,
        default: () => Math.random().toString(36).substring(2, 8).toUpperCase()
    },
    referredBy: {
        type: String,
        default: null
    },
    orderHistory : [{
        type : Schema.Types.ObjectId,
        ref : "Order"
    }],
    createdOn : {
        type : Date,
        default : Date.now,
    },
    searchHistory : [{
        category : {
            type: Schema.Types.ObjectId,
            ref : "Category"
        },
        brand : {
            type : String
        },
        searchOn : {
            type : Date,
            default : Date.now
        }
    }]
})



const User = mongoose.model("User",userSchema);


module.exports =  User;
