
const Order = require('../../models/orderSchema');

const listOrders = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('user') 
      .sort({ orderDate: -1 });

    res.render('orders', {
         orders 
        });
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).send("Internal Server Error");
  }
};

const viewOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user')
      .populate('orderedItems.product');

    res.render('orderDetail', { order });
  } catch (err) {
    console.error("Error fetching order details:", err);
    res.status(500).send("Internal Server Error");
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;

    await Order.findByIdAndUpdate(orderId, { status: newStatus });

    res.redirect(`/admin/orderList/${orderId}`);
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).send("Internal Server Error");
  }
};


module.exports = {
    listOrders,
    viewOrderDetails,
    updateOrderStatus
};
