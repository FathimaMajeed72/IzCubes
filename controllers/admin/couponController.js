const Coupon = require("../../models/couponSchema");
const mongoose = require("mongoose")



const getCouponPage = async(req,res)=>{
    try {

        const findCoupons = await Coupon.find({})

        return res.render("coupon",{coupons:findCoupons})
        
    } catch (error) {
        
        return res.redirect("/admin/pageerror")
    }

}


const createCoupon = async(req,res)=>{
    try {

        const data = {
            couponName : req.body.couponName,
            startDate : new Date(req.body.startDate + "T00:00:00"),
            endDate : new Date(req.body.endDate + "T00:00:00"),
            offerPrice : parseInt(req.body.offerPrice),
            minimumPrice : parseInt(req.body.minimumPrice),
            discountType: req.body.discountType || "fixed",
            maxDiscountAmount: req.body.discountType === "percentage" ? parseInt(req.body.maxDiscount) : null
        }

        const newCoupon = new Coupon({
            name : data.couponName,
            createdOn : data.startDate,
            expireOn : data.endDate,
            offerPrice : data.offerPrice,
            minimumPrice : data.minimumPrice,
            discountType: data.discountType, 
            maxDiscountAmount: data.discountType === "percentage" ? data.maxDiscountAmount : undefined 
        });
       
        await newCoupon.save();
        return res.redirect("/admin/coupon")
        
    } catch (error) {
        
        console.error("Error in createCoupon:", error);
        return res.redirect("/admin/pageerror")
    }

}


const editCoupon = async (req,res)=>{
    try {
        const id = req.query.id;
        const findCoupon = await Coupon.findOne({_id:id})
        res.render('edit-coupon',{
            findCoupon:findCoupon
        })
    } catch (error) {

        console.error("Error in editCoupon:", error);
        return res.redirect("/admin/pageerror")
        
    }
}


const updateCoupon = async (req,res) => {
    try {
        
        const couponId = req.body.couponId;
        const oid = new mongoose.Types.ObjectId(couponId);
        const selectedCoupon = await Coupon.findOne({_id: oid});
        if(selectedCoupon){
            const startDate = new Date(req.body.startDate);
            const endDate = new Date(req.body.endDate);

            const updatedFields = {
                name: req.body.couponName,
                createdOn: startDate,
                expireOn: endDate,
                offerPrice: parseInt(req.body.offerPrice),
                minimumPrice: parseInt(req.body.minimumPrice),
                discountType: req.body.discountType || "fixed",
            };

            if (req.body.discountType === "percentage") {
                updatedFields.maxDiscountAmount = parseInt(req.body.maxDiscount);
            } else {
                updatedFields.maxDiscountAmount = undefined;
            }

            const updateCoupon = await Coupon.updateOne(
                { _id: oid },
                { $set: updatedFields }
            );


           
            if(updateCoupon.modifiedCount > 0){
                res.send("Coupon updated successfully")
            }else{
                res.status(500).send("Coupon update failed")
            }
        }

    } catch (error) {
        console.error("Error in updateCoupon:", error);
        return res.redirect("/admin/pageerror")
    }
}


const deleteCoupon = async(req,res)=>{
    try {
        const id = req.query.id;
        await Coupon.deleteOne({_id:id});
        res.status(200).send({success:true,message:"Coupon deleted successfully"})
    } catch (error) {

        console.error("Error in deleteCoupon:", error);
        res.status(500).send({success:false,message:"Failed to delete coupon"})
        
    }
}



module.exports = {
    getCouponPage,
    createCoupon,
    editCoupon,
    updateCoupon,
    deleteCoupon,
}