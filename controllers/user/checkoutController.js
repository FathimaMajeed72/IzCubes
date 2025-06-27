const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require('../../models/addressSchema');



const checkout = async (req, res) => {
  try {
    const userId = req.session.user._id;

    const userData = await User.findById(userId);
    const addressData = await Address.findOne({userId:userData._id})

    const userAddresses = addressData ? addressData.address : [];

    const selectedAddress = userAddresses.find(addr => addr.isDefault) || null


    const cart = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart || !cart.items.length) {
      return res.redirect("/cart");
    }

    let subtotal = 0;
   // let discount = 0;
    //const TAX_PERCENT = 5;
    const SHIPPING_FEE = 40;

    const validItems = [];
    const removedItems = [];
   

    for (const item of cart.items) {
      const product = item.productId;
      const sizeStock = product.sizes.find(s => s.size === item.size);
      

      if (!sizeStock || sizeStock.quantity < item.quantity) {
        removedItems.push({
          productName: product.productName,
          size: item.size
        });
        continue;
      }
      subtotal += item.totalPrice;

      // const productOffer = product.productOffer || 0;
      // const offerAmount = Math.round((product.regularPrice * productOffer) / 100);
      // discount += offerAmount * item.quantity;

      validItems.push(item);
    }

    if (!validItems.length) {
      return res.redirect("/cart?error=All selected items are out of stock.");
    }

    //const tax = Math.round((subtotal * TAX_PERCENT) / 100);
    // const total = subtotal - discount + SHIPPING_FEE;
    const total = subtotal + SHIPPING_FEE;
    
    res.render("checkout", { 
      userAddresses,
      cart:  { items: validItems },
      subtotal,
      //discount,
      shipping: SHIPPING_FEE,
      total,
      selectedAddress,
      removedItems,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });

  } catch (err) {
    console.error("Checkout error", err);
    res.status(500).send("Server error");
  }
};


module.exports = {
    checkout,
}