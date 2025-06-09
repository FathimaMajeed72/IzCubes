
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



const handleReturnResponse = async (req, res) => {
  try {
    const { orderId, productId, size, action } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).send("Order not found");

    const item = order.orderedItems.find(
      i => i.product.toString() === productId && i.size === size
    );

    if (!item) return res.status(404).send("Ordered item not found");

    if (action === "Accept") {
      item.status = "Returned";
      order.returnStatus = "Accepted";


      const product = await Product.findById(productId);
      if (product) {
        const sizeEntry = product.sizes.find(s => s.size === size);
        if (sizeEntry) {
          sizeEntry.quantity += item.quantity;
        }
        await product.save();
      }

   

    } else if (action === "Reject") {
      order.returnStatus = "Rejected";
    }

    await order.save();
    res.redirect(`/admin/orderList/${orderId}?return=${action.toLowerCase()}`);
  } catch (err) {
    console.error("Return response error:", err);
    res.status(500).send("Internal Server Error");
  }
};




module.exports = {
    listOrders,
    viewOrderDetails,
    updateOrderStatus,
    handleReturnResponse
};
