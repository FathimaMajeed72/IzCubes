const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require('../../models/addressSchema');
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema")
const SHIPPING_FEE = 40;



const checkout = async (req, res) => {
  try {
    const userId = req.session.user._id;

    const retryOrderId = req.query.retryOrderId;



    const userData = await User.findById(userId);
    const addressData = await Address.findOne({userId:userData._id})

    const userAddresses = addressData ? addressData.address : [];

    const selectedAddress = userAddresses.find(addr => addr.isDefault) || null


    let validItems = [];
    let subtotal = 0;
    let retryOrder = null;
    let existingRazorpayOrderId = null;
    const removedItems = [];

    
    if (retryOrderId) {
      retryOrder = await Order.findById(retryOrderId).populate({
        path: "orderedItems.product",
        populate: { path: "category" } 
      });

      if (!retryOrder || retryOrder.user.toString() !== userId.toString() || retryOrder.paymentStatus !== "Failed") {
        return res.redirect("/cart");
      }

      for (const item of retryOrder.orderedItems) {
        const product = await Product.findById(item.product);
        if (product) {
          const sizeStock = product?.sizes.find(s => s.size === item.size);

          if (sizeStock && sizeStock.quantity >= item.quantity) {
            validItems.push({
              productId: product,
              size: item.size,
              quantity: item.quantity,
              totalPrice: item.price * item.quantity,
              price: item.price
            });

            subtotal += item.price * item.quantity;
          } else {
            removedItems.push({
              productId: product,
              size: item.size,
              quantity: item.quantity,
              totalPrice: item.price * item.quantity
            });
          }
        } else {
          removedItems.push({
            productId: null, 
            size: item.size,
            quantity: item.quantity,
            totalPrice: item.price * item.quantity
          });
        }
      }


      existingRazorpayOrderId = retryOrder.razorpayOrderId;

    } else {


      const cart = await Cart.findOne({ userId }).populate({
        path : 'items.productId',
        populate: { path: "category" }
      });

      if (!cart || !cart.items.length) {
        return res.redirect("/cart");
      }


      for (const item of cart.items) {
        const product = item.productId;
        const sizeStock = product.sizes.find(s => s.size === item.size);
        
        if (product && sizeStock && sizeStock.quantity >= item.quantity) {
          validItems.push({
            productId: product,
            size: item.size,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            price: product.salePrice
          });
          subtotal += item.totalPrice;
        } else {
          removedItems.push({
            productId: product,
            size: item.size,
            quantity: item.quantity,
            totalPrice: item.totalPrice
          });
        }      
      }
    }


     if (!validItems.length) {
        return res.redirect("/cart?error=All selected items are out of stock.");
      }

    const availableCoupons = await Coupon.find({
      isList: true,
      expireOn: { $gte: new Date() },
      usedBy: { $ne: userId },
      $or: [
        { user: null },          
        { user: userId }          
      ]
    });


     const total = subtotal + SHIPPING_FEE;
    
    res.render("checkout", { 
      userAddresses,
      cart:  { items: validItems },
      subtotal,
      shipping: SHIPPING_FEE,
      total,
      selectedAddress,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      retryOrderId: retryOrder ? retryOrder._id : null,
      existingRazorpayOrderId: existingRazorpayOrderId || null ,
      appliedCoupon: retryOrder?.couponId || '',
      couponDiscount: retryOrder?.couponDiscount || 0,
      coupons: availableCoupons,
      removedItems
    });

  } catch (err) {
    console.error("Checkout error", err);
    res.status(500).send("Server error");
  }
};


const validateCartQuantity = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate('items.productId');

    let removedItems = [];

    for (const item of cart.items) {
      const product = item.productId;
      const sizeObj = product.sizes.find(s => s.size === item.size);

      if (!sizeObj || sizeObj.quantity < item.quantity) {
        removedItems.push({
          name: product.productName,
          size: item.size
        });
      }
    }

    if (removedItems.length > 0) {
      return res.json({ valid: false, removedItems });
    }

    res.json({ valid: true });
  } catch (error) {
    console.error("Quantity validation error:", error);
    res.status(500).json({ valid: false, error: "Server error" });
  }
};




module.exports = {
    checkout,
    validateCartQuantity
}