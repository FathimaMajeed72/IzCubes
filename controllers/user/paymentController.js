const Razorpay = require("razorpay");
const Order = require("../../models/orderSchema");


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});



const createRazorpayOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    
    if (!amount || isNaN(amount) || amount < 1) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    
    const options = {
      amount: amount, 
      currency: "INR",
      receipt: "order_rcptid_" + Date.now(),
    };

    const order = await razorpay.orders.create(options);

    res.json({ success: true, order });
  } catch (err) {
    console.error("Razorpay order error:", err);
    res.status(500).json({ success: false, message: "Order creation failed" });
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
 // getRetryPaymentPage
};
