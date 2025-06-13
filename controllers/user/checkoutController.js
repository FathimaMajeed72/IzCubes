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
    let discount = 0;
    const TAX_PERCENT = 5;
    const SHIPPING_FEE = 40;
   

    for (const item of cart.items) {
      const product = item.productId;
      const sizeStock = product.sizes.find(s => s.size === item.size);
      

      if (!sizeStock || sizeStock.quantity < item.quantity) {
        return res.status(400).render("user/cart", {
          error: `Product "${product.productName}" in size "${item.size}" is out of stock.`,
          cartItems: cart.items,
          total: cart.items.reduce((sum, i) => sum + i.totalPrice, 0)
        });
      }
      subtotal += item.totalPrice;

      const productOffer = product.productOffer || 0;
      const offerAmount = Math.round((product.regularPrice * productOffer) / 100);
      discount += offerAmount * item.quantity;
    }

    //const tax = Math.round((subtotal * TAX_PERCENT) / 100);
    const total = subtotal - discount + SHIPPING_FEE;

    
    res.render("checkout", { 
      userAddresses,
      cart,
      subtotal,
      discount,
      shipping: SHIPPING_FEE,
      total,
      selectedAddress
    });

  } catch (err) {
    console.error("Checkout error", err);
    res.status(500).send("Server error");
  }
};



module.exports = {
    checkout,
}