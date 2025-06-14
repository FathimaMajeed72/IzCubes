
const Order = require('../../models/orderSchema');
const Product = require("../../models/productSchema")

const listOrders = async (req, res) => {
  try {

    const { search = "", sort = "desc", status, page = 1, limit = 4 } = req.query;

    const query = {};

   
    if (status && status !== "All") {
      query.status = status;
    }

    let allOrders = await Order.find(query)
      .populate('user')
      .sort({ createdOn: sort === "asc" ? 1 : -1 });


    if (search.trim()) {
      const s = search.toLowerCase();
      allOrders = allOrders.filter(order =>
        order.orderId.toLowerCase().includes(s) ||
        (order.user?.name?.toLowerCase().includes(s)) ||
        (order.user?.email?.toLowerCase().includes(s))
      );
    }


    const skip = (parseInt(page) - 1) * parseInt(limit);

    
    const totalOrders = allOrders.length;
    const totalPages = Math.ceil(totalOrders / limit);
    const paginatedOrders = allOrders.slice(skip, skip + parseInt(limit));




    res.render('orders', {
         orders:paginatedOrders,
         search,
         sort,
         status,
         currentPage: parseInt(page),
         totalPages
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

      order.status="Returned"

      for (const item of order.orderedItems) {
        const product = await Product.findById(item.product);
        if (product) {
          const sizeVariant = product.sizes.find(s => s.size === item.size);
          if (sizeVariant) sizeVariant.quantity += item.quantity;
          await product.save();
        }
      }
    }else{
      order.status="Return Rejected"
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
