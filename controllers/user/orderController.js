const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Coupon = require("../../models/couponSchema");
const User = require("../../models/userSchema");
const crypto = require('crypto');
const TAX_PERCENT = 5;
const SHIPPING_FEE = 40;


const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const addressId = req.body.addressId;
    const paymentMethod = req.body.paymentMethod;

    const couponId = req.body.couponId;
    const offerPrice = Math.abs(parseInt(req.body.offerPrice)) || 0;

    const retryOrderId = req.body.retryOrderId;

    const {razorpay_order_id,razorpay_payment_id, razorpay_signature} = req.body;

    console.log(userId);
    
    console.log(addressId);
    
    if (!addressId) {
      return res.status(400).send("No address selected.");
    }


    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    let validItems = [];
    let removedItems = [];
    let subtotal = 0;
    let discount = offerPrice;
    let productDiscount = 0;

    for (const item of cart.items) {
      const product = item.productId;
      const sizeObj = product.sizes.find(s => s.size == item.size);

      if (sizeObj && sizeObj.quantity >= item.quantity) {
        // const productOffer = product.productOffer || 0;
        // const offerAmount = Math.round((product.regularPrice * productOffer) / 100);
        const offerAmount = product.regularPrice-product.salePrice;
        productDiscount += offerAmount * item.quantity;
        subtotal += item.totalPrice;
        validItems.push(item);
      } else {
        removedItems.push({
          name: product.productName,
          size: item.size
        });
      }
    }

     if (validItems.length === 0) {
      return res.render("cart", {
        cartItems: cart.items,
        subtotal: 0,
        discount: 0,
        total: 0,
        shipping: 0,
        error: "All items in your cart are out of stock."
      });
    }

    const totalPrice = subtotal;
    const finalAmount = subtotal - discount + SHIPPING_FEE;


    if (isNaN(finalAmount)) {
      throw new Error("Final amount is not a number");
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc) {
      return res.status(400).send("No address document found for user.");
    }

    const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === addressId);
    if (!selectedAddress) {
      return res.status(400).send("Selected address not found");
    }

    const orderedItems = validItems.map(item => ({
      product: item.productId._id,
      size: item.size,
      quantity: item.quantity,
      price: item.productId.salePrice
    }));


    let paymentStatus = "Pending";
    let paymentId = null;
    let razorpayOrderId = null;

    if (paymentMethod === "Online") {

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).send("Missing Razorpay payment details");
      }


      const body = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).send("Invalid Razorpay signature");
      }

      paymentStatus = "Success";
      paymentId = razorpay_payment_id;
      razorpayOrderId = razorpay_order_id;
    } else if (paymentMethod === "COD") {
      paymentStatus = "Pending"; 
    } else {
      return res.status(400).send("Unsupported payment method");
    }




    if (couponId) {
      await Coupon.updateOne(
        { _id: couponId },
        { $addToSet: { usedBy: userId } }
      );
    }


    let newOrder;

   
    if (retryOrderId) {
      newOrder = await Order.findById(retryOrderId);
      if (!newOrder || newOrder.paymentStatus !== "Failed") {
        return res.status(400).send("Retry order invalid or already paid");
      }

      newOrder.orderedItems = orderedItems;
      newOrder.address = selectedAddress;
      newOrder.totalPrice = totalPrice;
      newOrder.finalAmount = finalAmount;
      newOrder.discount = productDiscount
      newOrder.couponId = couponId || null;
      newOrder.couponDiscount = offerPrice;
      newOrder.paymentMethod = paymentMethod;
      newOrder.paymentStatus = paymentStatus;
      newOrder.paymentId = paymentId;
      newOrder.razorpayOrderId = razorpayOrderId;
      newOrder.status = "Pending";
      newOrder.createdOn = new Date();

      await newOrder.save();
    } else {

      newOrder = new Order({
      user: userId,
      orderedItems,
      address: selectedAddress,
      totalPrice,
      finalAmount,
      discount : productDiscount,
      couponId: couponId || null,
      couponDiscount: offerPrice,
      paymentMethod,
      paymentStatus,
      paymentId,
      razorpayOrderId: razorpay_order_id || null,
      status: "Pending" ,
      createdOn: new Date()
    });

    await newOrder.save();
  }

    for (const item of orderedItems) {
      await Product.updateOne(
        { _id: item.product, "sizes.size": item.size },
        { $inc: { "sizes.$.quantity": -item.quantity } }
      );
    }

   
    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

    res.redirect(`/order-success?orderId=${newOrder._id}`);

  } catch (error) {
    console.error("Error placing COD order:", error);
    res.status(500).json({ message: "Server error while placing order" });
  }
};






const orderSuccess = async (req,res) => {
    try {

        res.render("order-success")

        
    } catch (error) {
        console.log("Error loading Order Succesfull Page");
        res.redirect("/pageNotFound");
    }
}

const orderFailure = async (req,res) => {
    try {
      const razorpay_order_id = req.query.razorpay_order_id;
      if (!razorpay_order_id) return res.redirect("/cart");

      const failedOrder = await Order.findOne({ razorpayOrderId: razorpay_order_id });

      if (!failedOrder || failedOrder.paymentStatus !== "Failed") {
        return res.redirect("/cart");
      }

      res.render("order-failure", {
        failedOrder,
      });

        
    } catch (error) {
        console.log("Error loading Order Failure Page");
        res.redirect("/pageNotFound");
    }
}


const getOrderDetail = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .populate('user')
      .populate('orderedItems.product')
      .populate('couponId')
      .populate({
        path: 'address',
        populate: {
          path: 'userId', 
        }
      });

    if (!order) {
      return res.status(404).render('page-404');
    }

    res.render('order-detail', { 
      order,
      shipping: SHIPPING_FEE
     });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};



const cancelEntireOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    const order = await Order.findOne({ orderId }).populate("orderedItems.product");
    if (!order) return res.status(404).send("Order not found");

    if (order.status === 'Cancelled') {
      return res.status(400).send("Order already cancelled");
    }

    
    
    for (const item of order.orderedItems) {
      await Product.updateOne(
        { _id: item.product._id, "sizes.size": item.size },
        { $inc: { "sizes.$.quantity": item.quantity } }
      );

      item.status = 'Cancelled';
      item.cancelReason = reason || '';
    }


   if (order.paymentMethod === 'Online') {
      const user = await User.findById(order.user);
      if (user && order.finalAmount > 0) {
        user.wallet.balance += order.finalAmount;
        user.wallet.transactions.push({
          type: 'credit',
          amount: order.finalAmount,
          reason: 'Refund for full order cancellation',
          orderId: order._id
        });
        await user.save();
      }
    }




    order.status = 'Cancelled';
    order.cancellationReason = reason || '';
    order.totalPrice = 0;
    order.couponDiscount = 0;
    order.finalAmount = 0;

    await order.save();

    res.redirect(`/orders/${orderId}?cancelSuccess=true`);
    
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};


const cancelOrderItem = async (req, res) => {
  try {
    const { orderId, productId, reason } = req.body;

    console.log("productId from req.body:", productId);


    const order = await Order.findOne({ orderId }).populate("orderedItems.product");
    if (!order) return res.status(404).send("Order not found");


    const item = order.orderedItems.find(i => i.product._id.toString() === productId);

    console.log("Matched item:", item);
    console.log("Item status:", item?.status);
    if (!item || item.status !== 'Confirmed') {
      return res.status(400).send("Item cannot be cancelled");
    }

    
    item.status = 'Cancelled';
    item.cancelReason = reason || '';
    


    await Product.updateOne(
      { _id: item.product._id, "sizes.size": item.size },
      { $inc: { "sizes.$.quantity": item.quantity} }
    );


    let refundAmount = 0;
    if (order.paymentMethod === 'Online') {
      const itemTotal = item.price * item.quantity;
      const orderPayableAmount = order.totalPrice - order.couponDiscount;
      refundAmount = Math.round((itemTotal / order.totalPrice) * orderPayableAmount);

    
      const user = await User.findById(order.user);
      if (user && refundAmount > 0) {
        user.wallet.balance += refundAmount;
        user.wallet.transactions.push({
          type: 'credit',
          amount: refundAmount,
          reason: `Refund for cancelled item: ${item.product.productName}`,
          orderId: order._id
        });
        await user.save();
      }
    }




    let totalPrice = 0;
    let discount = 0;

    order.orderedItems.forEach(i => {
      if (i.status !== 'Cancelled') {
        // const productOffer = i.product.productOffer || 0;
        // const offerAmount = Math.round((i.price * productOffer) / 100);
        const offerAmount = i.product.regularPrice-i.product.salePrice;
        discount += offerAmount * i.quantity;
        totalPrice += i.price * i.quantity;
      }
    });

    order.totalPrice = totalPrice;
    order.discount = discount;

    if (order.couponDiscount > 0 && totalPrice > 0) {
      const originalTotal = order.orderedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
      const proportion = totalPrice / originalTotal;
      order.couponDiscount = Math.round(order.couponDiscount * proportion);
    }

    order.finalAmount = totalPrice - order.couponDiscount + SHIPPING_FEE;
    


    const allCancelled = order.orderedItems.every(i => i.status === 'Cancelled');
    if (allCancelled) {
      order.status = 'Cancelled';
      order.finalAmount = 0;
      order.totalPrice = 0;
      order.discount = 0;
    }


    await order.save();
    res.redirect(`/orders/${orderId}?itemCancelSuccess=true`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};





const returnEntireOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order || order.status !== 'Delivered') {
      return res.status(400).send("Entire order return only after delivery");
    }

    if (!reason) return res.status(400).send("Return reason is required");

    for (const item of order.orderedItems) {
      if (item.status === 'Confirmed') {
        item.status = 'Returned';
        item.returnReason = reason;

        // await Product.updateOne(
        //   { _id: item.product._id, "sizes.size": item.size },
        //   { $inc: { "sizes.$.quantity": item.quantity } }
        // );

      }
    }

    order.status = 'Return Request';
    order.isReturnRequested = true;
    order.returnReason = reason;
    order.returnStatus = 'Pending';
    await order.save();

    // res.redirect('/userProfile?returnSuccess=true');

     res.redirect(`/orders/${orderId}?returnSuccess=true`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};


const returnOrderItem = async (req, res) => {
   try {
    const { orderId, productId, reason } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).send("Order not found");

    const item = order.orderedItems.find(i => i.product.toString() === productId);
    if (!item) return res.status(404).send("Item not found");

    if (item.status === 'Cancelled' || item.status === 'Returned') {
      return res.status(400).send("This item cannot be returned");
    }

   
    item.returnReason = reason;
    item.returnStatus = 'Pending';
    item.status = 'Returned';

    

    await order.save();

    return res.redirect(`/orders/${orderId}?returnSuccess=true`);
  } catch (err) {
    console.error("Return item error:", err);
    res.status(500).send("Server error");
  }
};


const searchUserOrders = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const query = req.query.q.trim();
    const regex = new RegExp(query, "i");

    
    const orders = await Order.find({ user: userId })
      .populate("orderedItems.product")
      .sort({ createdOn: -1 });

   
    const filteredOrders = orders.filter(order => {
      const matchOrderId = order.orderId.match(regex);
      const matchProduct = order.orderedItems.some(item =>
        item?.product?.productName?.match(regex)
      );
      return matchOrderId || matchProduct;
    });

    res.render("profile", {
      orders: filteredOrders,
      query,
      user: req.session.user,
      section: "orders",
      
    });
  } catch (err) {
    console.error("Search error:", err);
    res.redirect("/profile");
  }
};



module.exports = {
    placeOrder,
    orderSuccess,
    orderFailure,
    getOrderDetail,
    cancelEntireOrder,
    cancelOrderItem,
    returnEntireOrder,
    returnOrderItem,
    searchUserOrders,

}