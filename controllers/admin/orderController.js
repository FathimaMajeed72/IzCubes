
const Order = require('../../models/orderSchema');
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema")
const SHIPPING_FEE = 40;

const listOrders = async (req, res) => {
  try {

    const { search = "", sort = "desc", status, page = 1, limit = 4 } = req.query;

    const query = {
      status: { $ne: "Payment Failed" }
    };

   
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
      .populate('couponId')
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
        item.status = 'Returned';
        const product = await Product.findById(item.product);
        if (product) {
          const sizeVariant = product.sizes.find(s => s.size === item.size);
          if (sizeVariant) sizeVariant.quantity += item.quantity;
          await product.save();
        }
      }

      const refundedAmount = order.finalAmount-SHIPPING_FEE;
      order.totalPrice = 0;
      // order.discount = 0;
      order.couponDiscount = 0;
      order.finalAmount = 0;

      const user = await User.findById(order.user);
      if (user) {
        user.wallet.balance += refundedAmount;
        user.wallet.transactions.push({
          type: 'credit',
          amount: refundedAmount,
          reason: 'Return approved',
          orderId: order._id
        });

        await user.save();
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


const handleItemReturnRequest = async (req, res) => {
  try {
      const { orderId, productId, action } = req.body;

      const order = await Order.findById(orderId);
      if (!order) return res.status(404).send("Order not found");

      const item = order.orderedItems.find(i => i.product.toString() === productId);
      if (!item) return res.status(404).send("Item not found");

      item.returnStatus = action;
      
      if (action === 'Accepted') {
        item.status = 'Returned';

       
        let refundedAmount = 0;
        const product = await Product.findById(productId);
        if (product) {
          const sizeVariant = product.sizes.find(s => s.size === item.size);
          if (sizeVariant) {
            sizeVariant.quantity += item.quantity;
          }
          await product.save();

          const itemTotal = item.price * item.quantity;
          const orderPayableAmount = order.totalPrice - order.couponDiscount;

          refundedAmount = Math.round((itemTotal / order.totalPrice) * orderPayableAmount);



          
          const user = await User.findById(order.user);
          if (user) {
            user.wallet.balance += refundedAmount;
            user.wallet.transactions.push({
              type: 'credit',
              amount: refundedAmount,
              reason: `Return approved for item ${product.productName}`,
              orderId: order._id
            });

            await user.save();
          }

        }

        const activeItems = order.orderedItems.filter(i => i.status !== 'Cancelled' && i.status !== 'Returned');

        let totalPrice = 0;
        // let totalDiscount = 0;


        for (const item of activeItems) {
          const product = await Product.findById(item.product);
          if (product) {
            const itemTotal = product.salePrice * item.quantity;
            // const itemRegularTotal = product.regularPrice * item.quantity;
            // const itemDiscount = itemRegularTotal - itemTotal;

            totalPrice += itemTotal;
            // totalDiscount += itemDiscount;
          }
        }

       
        order.totalPrice = totalPrice;
        //order.discount = totalDiscount; 
        
        if (order.couponDiscount > 0 && totalPrice > 0) {
          const originalTotal = order.orderedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
          const proportion = totalPrice / originalTotal;
          order.couponDiscount = Math.round(order.couponDiscount * proportion);
        }

      order.finalAmount = order.totalPrice - order.couponDiscount + SHIPPING_FEE;


        const allReturned = order.orderedItems.every(i => i.status === 'Returned' || i.status === 'Cancelled');
        if (allReturned) {
          order.status = 'Returned';
          order.returnStatus = 'Accepted';
          order.returnReason = 'All items returned individually and accepted';
          order.isReturnRequested = true;
        }



      } else if (action === 'Rejected') {
        item.status = 'Confirmed'; 
      }


      await order.save();

      res.redirect(`/admin/orderList/${orderId}`);
  } catch (error) {
    console.error("Return decision error:", error);
    res.status(500).send("Internal Server Error");
  }
};



module.exports = {
    listOrders,
    viewOrderDetails,
    updateOrderStatus,
    handleReturnRequest,
    handleItemReturnRequest
};
