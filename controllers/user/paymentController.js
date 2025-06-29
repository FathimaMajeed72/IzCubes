const Razorpay = require("razorpay");
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema")
const crypto = require('crypto');
const SHIPPING_FEE=40;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});



const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, retryOrderId, existingRazorpayOrderId } = req.body;

    
    if (!amount || isNaN(amount) || amount < 1) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }



    if (retryOrderId && existingRazorpayOrderId) {
      const existingOrder = await Order.findById(retryOrderId);

      if (
        existingOrder &&
        existingOrder.paymentStatus === "Failed" &&
        existingOrder.razorpayOrderId === existingRazorpayOrderId
      ) {
        return res.json({
          success: true,
          order: {
            id: existingOrder.razorpayOrderId,
            amount: amount,
            currency: "INR"
          }
        });
      }
    }

    
    const options = {
      amount: amount, 
      currency: "INR",
      receipt: "order_rcptid_" + Date.now(),
    };

    const newOrder = await razorpay.orders.create(options);

    res.json({ success: true, order: newOrder });
  } catch (err) {
    console.error("Razorpay order error:", err);
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
};


const saveFailedOrder = async (req, res) => {
  try {
    const { razorpay_order_id, amount, addressId, couponId, offerPrice } = req.body;
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) return res.status(400).json({ success: false });

    const validItems = cart.items.map(item => ({
      product: item.productId._id,
      size: item.size,
      quantity: item.quantity,
      price: item.productId.salePrice,
    }));

    const addressDoc = await Address.findOne({ userId });
    const selectedAddress = addressDoc.address.find(a => a._id.toString() === addressId);

    if (!selectedAddress) {
      return res.status(400).json({ success: false, message: "Invalid address" });
    }

    const existing = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    if (existing) {
      return res.status(200).json({ success: true, message: "Order already exists" });
    }



    const subtotal = cart.items.reduce((sum, item) => sum + item.productId.salePrice * item.quantity, 0);
    const finalAmount = subtotal - (offerPrice || 0) + SHIPPING_FEE;

    const order = new Order({
      user: userId,
      orderedItems: validItems,
      address: selectedAddress,
      totalPrice: subtotal,
      finalAmount,
      couponId: couponId || null,
      couponDiscount: offerPrice || 0,
      paymentMethod: "Online",
      paymentStatus: "Failed",
      paymentId: null,
      razorpayOrderId: razorpay_order_id,
      status: "Payment Failed",
      createdOn: new Date()
    });

    await order.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Error saving failed order:", err);
    res.status(500).json({ success: false });
  }
};




// const getRetryPaymentPage = async (req, res) => {
//   try {
//     const orderId = req.query.orderId;

//     const order = await Order.findOne({ orderId }).populate("user");

//     if (!order || order.paymentStatus !== "Failed" || order.paymentMethod !== "Online") {
//       return res.redirect("/cart");
//     }

//     res.render("user/retry-payment", {
//       order,
//       razorpayKeyId: process.env.RAZORPAY_KEY_ID,
//     });
//   } catch (err) {
//     console.error("Retry Payment Load Error:", err);
//     res.redirect("/cart");
//   }
// };






module.exports = {
  createRazorpayOrder,
  saveFailedOrder,
 // getRetryPaymentPage
};
