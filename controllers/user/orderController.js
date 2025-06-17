const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const TAX_PERCENT = 5;
const SHIPPING_FEE = 40;


const placeCodOrder = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const addressId = req.body.addressId;
    console.log(userId);
    
    console.log(addressId);
    
    if (!addressId) {
      return res.status(400).send("No address selected.");
    }


    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    let subtotal = 0;
    let discount = 0;

    for (const item of cart.items) {
      const product = item.productId;
      const productOffer = product.productOffer || 0;
      const offerAmount = Math.round((product.salePrice * productOffer) / 100);
      discount += offerAmount * item.quantity;
      subtotal += item.totalPrice;

      
      const sizeObj = product.sizes.find(s => s.size == item.size);
      if (!sizeObj || sizeObj.quantity < item.quantity) {
        return res.status(400).send(`Insufficient stock for ${product.productName} (Size ${item.size})`);
      }
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

    const orderedItems = cart.items.map(item => ({
      product: item.productId._id,
      size: item.size,
      quantity: item.quantity,
      price: item.productId.salePrice
    }));

    const newOrder = new Order({
      user: userId,
      orderedItems,
      address: selectedAddress,
      totalPrice,
      finalAmount,
      paymentMethod: "COD",
      status: "Pending",
      createdOn: new Date()
    });

    await newOrder.save();


    for (const item of orderedItems) {
      await Product.updateOne(
        { _id: item.product, "sizes.size": item.size },
        { $inc: { "sizes.$.quantity": -item.quantity } }
      );
    }

   
    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

    res.redirect("/order-success");

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


const getOrderDetail = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .populate('user')
      .populate('orderedItems.product')
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

    // Update stock for all products
    for (const item of order.orderedItems) {
      await Product.updateOne(
        { _id: item.product._id, "sizes.size": item.size },
        { $inc: { "sizes.$.quantity": item.quantity } }
      );

      item.status = 'Cancelled';
      item.cancelReason = reason || '';
    }

    order.status = 'Cancelled';
    order.cancellationReason = reason || '';
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


    let totalPrice = 0;
    let discount = 0;

    order.orderedItems.forEach(i => {
      if (i.status !== 'Cancelled') {
        const productOffer = i.product.productOffer || 0;
        const offerAmount = Math.round((i.price * productOffer) / 100);
        discount += offerAmount * i.quantity;
        totalPrice += i.price * i.quantity;
      }
    });

    order.totalPrice = totalPrice;
    order.discount = discount;
    order.finalAmount = totalPrice - discount + SHIPPING_FEE;


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

        await Product.updateOne(
          { _id: item.product._id, "sizes.size": item.size },
          { $inc: { "sizes.$.quantity": item.quantity } }
        );

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
    placeCodOrder,
    orderSuccess,
    getOrderDetail,
    cancelEntireOrder,
    cancelOrderItem,
    returnEntireOrder,
    searchUserOrders,

}