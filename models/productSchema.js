const mongoose = require("mongoose");
const {Schema} = mongoose;


const productSchema = new Schema({
    productName : {
        type : String,
        required : true
    },
    description : {
        type : String,
        required : true
    },
    brand : {
        type : String,
        required : true
    },
    category : {
        type : Schema.Types.ObjectId,
        ref : "Category",
        required : true
    },
    regularPrice : {
        type : Number,
        required : true
    },
    salePrice : {
        type : Number,
        required : true
    },
    productOffer : {
        type : Number,
        default : 0
    },
    sizes: [
        {
            size: {
                type: String,
                enum: ["0-1","1-2", "2-3", "3-4", "4-5", "5-6", "6-7", "7-8", "8-9", "9-10"],
                required: true
            },
            quantity: {
                    type: Number,
                    required: true,
                    min: 0
            }
        }
    ],
    color : {
        type : String,
        required : true
    },
    productImage : {
        type : [String],
        required : true
    },
    isBlocked : {
        type : Boolean,
        default : false
    },
    status : {
        type : String,
        enum : ["Available", "Out of Stock", "Discontinued"],
        required : true,
        default : "Available"
    }
},{timestamps : true});

 
const Product = mongoose.model("Product",productSchema);


module.exports = Product;