const Coupon = require('../../models/couponSchema');






const applyCoupon = async (req, res) => {
  try {
    const { couponCode, subtotal } = req.body;
    const userId = req.session.user._id;

    const coupon = await Coupon.findOne({
      name: couponCode,
      isList: true,
      expireOn: { $gte: new Date() },
      minimumPrice: { $lte: subtotal },
    });

    if (!coupon) {
      return res.status(400).json({ success: false, message: "Invalid or expired coupon" });
    }


    if (coupon.usedBy.includes(userId)) {
      return res.status(400).json({ success: false, message: "Coupon already used" });
    }

    return res.status(200).json({
      success: true,
      offerPrice: coupon.offerPrice,
      couponId: coupon._id,
      message: "Coupon applied successfully",
    });
  } catch (err) {
    console.error("Coupon apply error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};





const removeCoupon = async (req, res) => {
  try {
    return res.status(200).json({ success: true, message: "Coupon removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error removing coupon" });
  }
};




module.exports = {
    applyCoupon,
    removeCoupon,
};
