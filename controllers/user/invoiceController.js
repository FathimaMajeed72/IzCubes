const PDFDocument = require('pdfkit');
const Order = require('../../models/orderSchema');
const fs = require('fs');
const path = require('path');

const generateInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('orderedItems.product');

    if (!order) return res.status(404).send('Order not found');

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');

    doc.pipe(res);

    
    const logoPath = path.join(__dirname, '..','..', 'public', 'img', 'logo_IzCubes.png');
    
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 45, { width: 100 });
    }else {
       console.log('Logo file not found:', logoPath);
    }

    doc.fontSize(20).text('INVOICE', 200, 50, { align: 'right' }).moveDown(2);

    
    doc.fontSize(12)
      .text(`Order ID: ${order.orderId}`,50,100)
      .text(`Order Date: ${order.createdOn.toDateString()}`,50,120)
      .text(`Customer: ${order.address.name}`,50,140)
      .text(`Phone: ${order.address.phone}`,50,160)
      .text(`Address: ${order.address.houseName}, ${order.address.streetName}, ${order.address.city} - ${order.address.pincode}`,50,180)
      
      .text(`Payment Method: ${order.paymentMethod}`, 50, 200)
      .moveDown();
    
    const tableTop = doc.y;
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('No', 50, tableTop)
      .text('Product', 80, tableTop)
      .text('Qty', 250, tableTop)
      .text('Price', 300, tableTop)
      .text('Total', 360, tableTop)
      .text('Status', 430, tableTop);

    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
    doc.moveDown();

    let subtotal = 0;
    let validItemCount = 0;

    const isOrderReturned = order.status === 'Returned';


   
    order.orderedItems.forEach((item, i) => {
      const { product, quantity, price, status } = item;
      const itemTotal = price * quantity;
      const y = doc.y + 5;

      const isItemInvalid = status === 'Cancelled' || status === 'Returned';

      if (!isOrderReturned && !isItemInvalid){
        subtotal += itemTotal;
        validItemCount++;
      }
      

      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(isItemInvalid || isOrderReturned ? 'gray' : 'black')
        .text(`${i + 1}`, 50, y)
        .text(product.productName, 80, y)
        .text(quantity.toString(), 250, y)
        .text(`₹${price}`, 300, y)
        .text(`₹${itemTotal}`, 360, y)
        .text(status, 430, y);

      doc.moveDown();
    });

    
    doc.moveDown(1.5).fontSize(12).fillColor('black');
    // const discount = isOrderReturned ? 0 : order.discount || 0;
    // const couponDiscount = isOrderReturned ? 0 : order.couponDiscount || 0;
    const couponDiscount = isOrderReturned ? 0 : order.couponDiscount || 0;
    const shipping = isOrderReturned ? 0 : validItemCount > 0 ? 40 : 0;
    const finalTotal = isOrderReturned ? 0 : subtotal - couponDiscount + shipping;

    doc.text(`Subtotal: ₹${subtotal}`, { align: 'right' });
    //doc.text(`Discount: -₹${discount}`, { align: 'right' });
    if (couponDiscount > 0) {
      doc.text(`Coupon Discount: -₹${couponDiscount}`, { align: 'right' });
    }
    doc.text(`Shipping: ₹${shipping}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text(`Total Payable: ₹${finalTotal}`, { align: 'right' });


    if (isOrderReturned) {
      doc.moveDown(1);
      doc.fontSize(12).fillColor('red').text('Note: This order was fully returned.',50,doc.y, { align: 'center' });
    }

    doc.end();

  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating invoice');
  }
};

module.exports = {
    generateInvoice,
}
