const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema")

const bcrypt = require("bcrypt");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');


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


const loadDashboard = async (req,res) => {
    if(req.session.admin){
        try {

            const { rangeType, startDate, endDate } = req.query;

            const salesReportQuery = {
                    $or: [
                { paymentMethod: "Online", paymentStatus: "Success" },
                { paymentMethod: "COD", status: "Delivered" }
                ]
            };

            
            const now = new Date();

            if (rangeType === "daily") {

            const today = new Date(now.setHours(0, 0, 0, 0));
            salesReportQuery.createdOn = { $gte: today };

            } else if (rangeType === "weekly") {

            const startOfWeek = new Date();
            startOfWeek.setDate(now.getDate() - 7);
            salesReportQuery.createdOn = { $gte: startOfWeek };

            } else if (rangeType === "monthly") {

            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            salesReportQuery.createdOn = { $gte: startOfMonth };

            } else if (rangeType === "custom" && startDate && endDate) {

            salesReportQuery.createdOn = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };

            }

           
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

            
            const orders = await Order.find(salesReportQuery)
            .populate("user couponId")
            .sort({ createdOn: -1 });

            console.log("Orders found for report:", orders.length);
            orders.forEach(o => console.log(o.createdOn, o.status, o.finalAmount));


            res.render("dashboard",{
                orders,
                report,
                filters: req.query
            });

        } catch (error) {
            res.redirect("/pageerror")
        }
    }
}


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
    const headers = ['Date', 'Order ID', 'User', 'Offer\nDiscount\n(INR)', 'Total\nSales Price\n(INR)', 'Coupon', 'Coupon\nDiscount\n(INR)', 'Shipping\n(INR)', 'Final\nAmount\n(INR)'];
    const colWidths = [50, 70, 60, 55, 60, 55, 70, 50, 60];
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



    // Table rows
    addTableHeader();
    let y = doc.y;

    for (const order of orders) {
      if (y > 700) {
        doc.addPage();
        y = 50;
        addTableHeader();
      }

      const row = [
        order.createdOn.toLocaleDateString('en-IN'),
        order.orderId.slice(-10),
        order.user?.name || 'Guest',
        `${order.discount || 0}`,
        `${order.totalPrice || 0}`,
        order.couponId?.name || 'None',
        `${order.couponDiscount || 0}`,
        `40`,
        `${order.finalAmount || 0}`,
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

    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Add Header Row
    worksheet.addRow([
      'Date', 'Order ID', 'User', 'Offer Discount (INR)',
      'Total Sales Price (INR)', 'Coupon', 'Coupon Discount (INR)',
      'Shipping (INR)', 'Final Amount (INR)'
    ]);

    // Add Data Rows
    orders.forEach(order => {
      worksheet.addRow([
        order.createdOn.toLocaleDateString('en-IN'),
        order.orderId.slice(-10),
        order.user?.name || 'Guest',
        order.discount || 0,
        order.totalPrice || 0,
        order.couponId?.name || 'None',
        order.couponDiscount || 0,
        40,
        order.finalAmount || 0
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





module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    downloadSalesReportPDF,
    downloadSalesReportExcel
}