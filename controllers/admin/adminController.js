const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema")

const bcrypt = require("bcrypt");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];


const pageerror = async (req,res) => {
    res.render("admin-error")
}


const loadLogin = (req,res)=>{
    
    if(req.session.admin && req.session.admin._id){
        return res.redirect("/admin")
    }
    res.render("admin-login",{message:null})
}

const login = async (req,res) => {
    try {
        
    const {email,password} = req.body;
    const admin = await User.findOne({email:email,isAdmin:true});
    if(admin){
        const passwordMatch = await bcrypt.compare(password,admin.password)
        if(passwordMatch){
            req.session.admin = {
                _id: admin._id,
                name: admin.name,
                email: admin.email
                };
            return res.redirect("/admin")
        }else{
            return res.render("admin-login",{message:"Incorrect Password"})
        } 
    }else{
        return res.render("admin-login",{message:"Admin not found"})
    }

    } catch (error) {
        console.log("Login error",error);
        return res.redirect("/pageerror")
    }
}



function generateDateLabels(rangeType, start, end) {
  const labels = [];
  const current = new Date(start);

  while (current <= end) {
    let label;

    if (rangeType === "yearly") {
      label = monthNames[current.getMonth()]; 
      current.setMonth(current.getMonth() + 1);
    } else if (
      rangeType === "monthly" ||
      rangeType === "weekly" ||
      rangeType === "custom"
    ) {
     // label = current.toISOString().slice(0, 10);
      label = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-${String(current.getUTCDate()).padStart(2, '0')}`;
      current.setDate(current.getDate() + 1);
    } else if (rangeType === "daily") {
      const istDate = new Date(current.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      label = `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2,'0')}-` +
              `${String(istDate.getDate()).padStart(2,'0')}T` +
              `${String(istDate.getHours()).padStart(2,'0')}:00`;
      current.setHours(current.getHours() + 1);
    }

    labels.push(label);
  }

  return labels;
}

const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      let { rangeType, startDate, endDate } = req.query;

      const salesReportQuery = {
        $or: [
          { paymentMethod: "Online", paymentStatus: "Success" },
          { paymentMethod: "COD", status: "Delivered" }
        ]
      };

      const now = new Date();
      let start, end;

      if (!rangeType) {
        rangeType = "daily"; 
      }

      
      if (rangeType === "daily") {
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setDate(now.getDate() +1);
        end.setHours(0, 0, 0, 0);
        // end.setHours(23, 59, 59, 999);

        salesReportQuery.createdOn = { $gte: start };
      } else if (rangeType === "weekly") {
        start = new Date();
        start.setDate(now.getDate() - 7);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        salesReportQuery.createdOn = { $gte: start };
      } else if (rangeType === "monthly") {
        const current = new Date();
        start = new Date(current.getFullYear(), current.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        salesReportQuery.createdOn = { $gte: start, $lte: end };
      } else if (rangeType === "yearly") {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
        salesReportQuery.createdOn = { $gte: start };
      } else if (rangeType === "custom" && startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        salesReportQuery.createdOn = {
          $gte: start,
          $lte: end
        };
      }

      
      let groupFormat;
      if (rangeType === "yearly") {
        groupFormat = {
          $dateToString: { format: "%Y-%m", date: "$createdOn", timezone: "Asia/Kolkata" }
        };
      } else if (
        rangeType === "monthly" ||
        rangeType === "weekly" ||
        rangeType === "custom"
      ) {
        groupFormat = {
          $dateToString: { format: "%Y-%m-%d", date: "$createdOn", timezone: "Asia/Kolkata" }
        };
      } else if (rangeType === "daily") {
        groupFormat = {
          $dateToString: { format: "%Y-%m-%dT%H:00", date: "$createdOn", timezone: "Asia/Kolkata" }
        };
      }

      
      const chartData = await Order.aggregate([
        { $match: salesReportQuery },
        {
          $group: {
            _id: groupFormat,
            totalSales: { $sum: "$finalAmount" },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      
      const expectedLabels = generateDateLabels(rangeType, start, end);
      const chartMap = {};
      chartData.forEach(entry => {
        let label = entry._id;

        if (rangeType === "yearly") {
          const monthIndex = parseInt(entry._id.split("-")[1], 10) - 1;
          label = monthNames[monthIndex];
        } 

        chartMap[label] = entry.totalSales;
      });

      const filledChartData = expectedLabels.map(label => ({
        label,
        totalSales: chartMap[label] || 0
      }));

      
      const summary = await Order.aggregate([
        { $match: salesReportQuery },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSales: { $sum: "$finalAmount" },
            totalOfferDiscount: { $sum: "$discount" },
            totalCouponDiscount: { $sum: "$couponDiscount" }
          }
        }
      ]);

      const report = summary[0] || {
        totalOrders: 0,
        totalSales: 0,
        totalOfferDiscount: 0,
        totalCouponDiscount: 0
      };


      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;

      const totalOrdersCount = await Order.countDocuments(salesReportQuery);
      const totalPages = Math.ceil(totalOrdersCount / limit);

      
      const orders = await Order.find(salesReportQuery)
        .populate("user couponId")
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(limit);



      const topProducts = await Order.aggregate([
        {
          $match: {
            $or: [
              { paymentMethod: "Online", paymentStatus: "Success" },
              { paymentMethod: "COD", status: "Delivered" }
            ]
          }
        },
        { $unwind: "$orderedItems" },
        {
          $group: {
            _id: "$orderedItems.product",
            totalSold: { $sum: "$orderedItems.quantity" },
            totalRevenue: { $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] } }
          }
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product"
          }
        },
        { $unwind: "$product" },
        {
          $project: {
            productId: "$product._id",
            name: "$product.productName",
            totalSold: 1,
            totalRevenue: 1
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]);



      const topCategories = await Order.aggregate([
        {
          $match: {
            $or: [
              { paymentMethod: "Online", paymentStatus: "Success" },
              { paymentMethod: "COD", status: "Delivered" }
            ]
          }
        },
        { $unwind: "$orderedItems" },
        {
          $lookup: {
            from: "products",
            localField: "orderedItems.product",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: "$productInfo" },
        {
          $group: {
            _id: "$productInfo.category",
            totalSold: { $sum: "$orderedItems.quantity" },
            totalRevenue: { $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] } }
          }
        },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "category"
          }
        },
        { $unwind: "$category" },
        {
          $project: {
            name: "$category.name",
            totalSold: 1,
            totalRevenue: 1
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]);


      const topBrands = await Order.aggregate([
        {
          $match: {
            $or: [
              { paymentMethod: "Online", paymentStatus: "Success" },
              { paymentMethod: "COD", status: "Delivered" }
            ]
          }
        },
        { $unwind: "$orderedItems" },
        {
          $lookup: {
            from: "products",
            localField: "orderedItems.product",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: "$productInfo" },
        {
          $group: {
            _id: "$productInfo.brand",
            totalSold: { $sum: "$orderedItems.quantity" },
            totalRevenue: { $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] } }
          }
        },
        {
          $lookup: {
            from: "brands",
            localField: "_id",
            foreignField: "brandName",
            as: "brand"
          }
        },
        { $unwind: "$brand" },
        {
          $project: {
            name: "$brand.brandName",
            totalSold: 1,
            totalRevenue: 1
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]);




            res.render("dashboard", {
              orders,
              report,
              chartData: filledChartData,
              filters: {
                ...req.query,
                rangeType
              },
              topProducts,
              topCategories,
              topBrands,
              currentPage: page,
              totalPages
            });
          } catch (error) {
            console.error("Dashboard load error:", error);
            res.redirect("/pageerror");
          }
        }
      };


const logout = async (req,res) => {
    try {

        req.session.destroy(err=>{
            if(err){
                console.log("error destroying session");
                return res.redirect("/pageerror")
            }
            res.redirect("/admin/login")
        })
        
    } catch (error) {
        console.log("unexpected error during logout",error);
        res.redirect("/pageerror")
    }
}




const downloadSalesReportPDF = async (req, res) => {
  try {
    const { rangeType, startDate, endDate } = req.query;

    const query = {
      $or: [
        { paymentMethod: 'Online', paymentStatus: 'Success' },
        { paymentMethod: 'COD', status: 'Delivered' }
      ]
    };

    const now = new Date();

    if (rangeType === 'daily') {
      query.createdOn = { $gte: new Date(now.setHours(0, 0, 0, 0)) };
    } else if (rangeType === 'weekly') {
      const weekStart = new Date(now.setDate(now.getDate() - 7));
      query.createdOn = { $gte: weekStart };
    } else if (rangeType === 'monthly') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      query.createdOn = { $gte: monthStart };
    } else if (rangeType === 'custom' && startDate && endDate) {
      query.createdOn = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const orders = await Order.find(query).populate('user couponId');

    // Summary calculations
    let totalSales = 0, totalOrders = 0, totalCoupons = 0, totalDiscounts = 0;

    orders.forEach(o => {
      totalOrders += 1;
      totalSales += o.finalAmount || 0;
      totalCoupons += o.couponDiscount || 0;
      totalDiscounts += o.discount || 0;
    });

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="sales_report.pdf"');
    doc.pipe(res);

    // Title
    doc.fontSize(20).text('Sales Report', { align: 'center' });
    doc.moveDown(2);

    // Summary
    doc.fontSize(14).text(`Summary`, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12)
      .text(`Total Orders: ${totalOrders}`)
      .text(`Total Sales: INR ${totalSales.toLocaleString('en-IN')}`)
      .text(`Total Offer Discount: INR ${totalDiscounts.toLocaleString('en-IN')}`)
      .text(`Total Coupon Discount: INR ${totalCoupons.toLocaleString('en-IN')}`);
    doc.moveDown(2);

    // Table headers
    const headers = ['Date', 'Order ID', 'User', 'Total\nSales Price\n(INR)', 'Coupon\nDiscount\n(INR)', 'Final\nAmount\n(INR)', 'Payment\nMethod', 'Status'];
    const colWidths = [55, 75, 60, 75, 65, 75, 55, 55];
    const colX = [];
    let x = 40;
    colWidths.forEach(w => {
      colX.push(x);
      x += w;
    });

    const addTableHeader = () => {
    doc.font('Helvetica-Bold').fontSize(8);
    const headerY = doc.y;

    headers.forEach((headerText, i) => {
        const lines = headerText.split('\n');  
        lines.forEach((line, idx) => {
        doc.text(line, colX[i], headerY + idx * 10, {
            width: colWidths[i],
            align: 'left',
            lineBreak: false
        });
        });
    });

    doc.moveDown(2);
    doc.font('Helvetica');
    };



    
    addTableHeader();
    let y = doc.y;

    for (const order of orders) {
      if (y > 700) {
        doc.addPage();
        y = 70;
        addTableHeader();
        y = doc.y + 10;
      }

      const row = [
        order.createdOn.toLocaleDateString('en-IN'),
        order.orderId.slice(-10),
        order.user?.name || 'Guest',
        `${order.totalPrice || 0}`,
        `${order.couponDiscount || 0}`,
        `${order.finalAmount || 0}`,
        (order.paymentMethod || 'N/A').toUpperCase(),
        order.status || 'N/A'
      ];

      row.forEach((text, i) => {
        doc.text(text, colX[i], y, { width: colWidths[i], align: 'left' });
      });

      y += 20;
      doc.moveTo(40, y - 5).lineTo(555, y - 5).strokeColor('#ccc').stroke();
    }
    

    doc.end();
  } catch (err) {
    console.error('PDF Download Error:', err);
    res.status(500).send('Failed to download PDF');
  }
};




const downloadSalesReportExcel = async (req, res) => {
  try {
    const { rangeType, startDate, endDate } = req.query;

    const query = {
      $or: [
        { paymentMethod: 'Online', paymentStatus: 'Success' },
        { paymentMethod: 'COD', status: 'Delivered' }
      ]
    };

    const now = new Date();

    if (rangeType === 'daily') {
      query.createdOn = { $gte: new Date(now.setHours(0, 0, 0, 0)) };
    } else if (rangeType === 'weekly') {
      const weekStart = new Date(now.setDate(now.getDate() - 7));
      query.createdOn = { $gte: weekStart };
    } else if (rangeType === 'monthly') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      query.createdOn = { $gte: monthStart };
    } else if (rangeType === 'custom' && startDate && endDate) {
      query.createdOn = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const orders = await Order.find(query).populate('user couponId');


    let totalSales = 0, totalOrders = 0, totalCoupons = 0, totalDiscounts = 0;
    orders.forEach(order => {
      totalOrders += 1;
      totalSales += order.finalAmount || 0;
      totalCoupons += order.couponDiscount || 0;
      totalDiscounts += order.discount || 0;
    });

    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.addRow(["Sales Report Summary Of IzCubes Kid's"]).font = { bold: true };
    worksheet.addRow([`Total Orders`, totalOrders]);
    worksheet.addRow([`Total Sales (INR)`, totalSales]);
    worksheet.addRow([`Total Offer Discount (INR)`, totalDiscounts]);
    worksheet.addRow([`Total Coupon Discount (INR)`, totalCoupons]);

     worksheet.addRow([]);

    
    worksheet.addRow([
      'Date', 'Order ID', 'User',
      'Total Sales Price (INR)', 'Coupon Discount (INR)', 'Final Amount (INR)',
      'Payment Method', 'Status'
    ]).font = { bold: true };

    
    orders.forEach(order => {
      worksheet.addRow([
        order.createdOn.toLocaleDateString('en-IN'),
        order.orderId.slice(-10),
        order.user?.name || 'Guest',
        order.totalPrice || 0,
        order.couponDiscount || 0,
        order.finalAmount || 0,
        order.paymentMethod || 'N/A',
        order.status || 'N/A'
      ]);
    });

    
    worksheet.columns.forEach(col => {
      let maxLength = 0;
      col.eachCell({ includeEmpty: true }, cell => {
        maxLength = Math.max(maxLength, cell.value?.toString().length || 10);
      });
      col.width = maxLength + 2;
    });

    
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="sales_report.xlsx"'
    );

    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel Download Error:', err);
    res.status(500).send('Failed to download Excel');
  }
};



const generateLedger = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [
        { paymentMethod: "Online", paymentStatus: "Success" },
        { paymentMethod: "COD", status: "Delivered" }
      ]
    }).sort({ createdOn: 1 });

    const ledger = [];
    let balance = 0;

    for (const order of orders) {
      const date = order.createdOn.toISOString().split("T")[0];

      
      balance += order.finalAmount;

      ledger.push({
        date,
        particulars: `Order #${order.orderId.slice(-8).toUpperCase()}`,
        credit: order.finalAmount,
        debit: 0,
        balance
      });

      const items = order.orderedItems;

      const returnedItems = items.filter(item => item.status === 'Returned');
      const cancelledItems = items.filter(item => item.status === 'Cancelled');

     
      if (order.status === 'Cancelled' && order.paymentMethod === 'Online') {
        balance -= order.finalAmount;

        ledger.push({
          date,
          particulars: `Full refund (Order Cancelled) #${order.orderId.slice(-8).toUpperCase()}`,
          credit: 0,
          debit: order.finalAmount,
          balance
        });
      }

      
      else if (
        returnedItems.length === items.length &&
        returnedItems.length > 0
      ) {
        const refund = returnedItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
        balance -= refund;

        ledger.push({
          date,
          particulars: `Full refund (Order Returned) #${order.orderId.slice(-8).toUpperCase()}`,
          credit: 0,
          debit: refund,
          balance
        });
      }

     
      else {
        for (const item of returnedItems) {
          const refund = item.quantity * item.price;
          balance -= refund;

          ledger.push({
            date,
            particulars: `Refund (Returned) for ${item.quantity} x ProductID(${item.product.toString().slice(-5)})`,
            credit: 0,
            debit: refund,
            balance
          });
        }


        if (order.paymentMethod === 'Online') {
          for (const item of cancelledItems) {
            const refund = item.quantity * item.price;
            balance -= refund;

            ledger.push({
              date,
              particulars: `Refund (Cancelled) for ${item.quantity} x ProductID(${item.product.toString().slice(-5)})`,
              credit: 0,
              debit: refund,
              balance
            });
          }
        }
      }
    }

    return res.render("ledger-book", { ledger });

  } catch (err) {
    console.error("Ledger generation failed:", err);
    return res.status(500).render("admin-error", {
      message: "Failed to generate ledger book."
    });
  }
};





module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    downloadSalesReportPDF,
    downloadSalesReportExcel,
    generateLedger
}