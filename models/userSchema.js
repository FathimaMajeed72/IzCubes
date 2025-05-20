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
        default : null
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
        default: "defaultProfileImage.jpg"
    },
    isBlocked : {
        type : Boolean,
        default : false
    },
    isAdmin : {
        type : Boolean,
        default : false
    },
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
