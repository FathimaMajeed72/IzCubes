
const Order = require('../../models/orderSchema');
const Product = require("../../models/productSchema")

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

    res.render('orderDetail', { order,req });
  } catch (err) {
    console.error("Error fetching order details:", err);
    res.status(500).send("Internal Server Error");
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;

    await Order.findByIdAndUpdate(orderId, { status: newStatus });

    res.redirect(`/admin/orderList/${orderId}?updated=true`);
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).send("Internal Server Error");
  }
};



const handleReturnRequest = async (req, res) => {
  try {
    const { orderId, action } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).send("Order not found");

    if (!['Accepted', 'Rejected'].includes(action)) {
      return res.status(400).send("Invalid action");
    }

    order.returnStatus = action;
    if (action === 'Accepted') {
      
      for (const item of order.orderedItems) {
        const product = await Product.findById(item.product);
        if (product) {
          const sizeVariant = product.sizes.find(s => s.size === item.size);
          if (sizeVariant) sizeVariant.quantity += item.quantity;
          await product.save();
        }
      }
    }

    await order.save();
    res.redirect(`/admin/orderList/${orderId}?updated=true`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};




module.exports = {
    listOrders,
    viewOrderDetails,
    updateOrderStatus,
    handleReturnRequest
};
