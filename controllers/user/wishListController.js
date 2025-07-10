const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");



const loadWishlist = async (req,res) => {
    try {

        const sessionUser = req.session.user;
        const user = await User.findById(sessionUser._id);

        const products = await Product.find({_id:{$in:user.wishlist}}).populate('category');

        res.render("wishlist",{
            user,
            wishlist : products,
    });
        
    } catch (error) {
        console.error("Error loading wishlist:", error);
        res.redirect("/pageNotFound");
    }
    
}




const addToWishlist = async (req,res) => {
    try {
        const productId = req.body.productId;
        const sessionUser = req.session.user;
        const user = await User.findById(sessionUser._id);

        if (!sessionUser) {
            return res.status(401).json({ status: false, message: "Unauthorized" });
        }


        const index = user.wishlist.indexOf(productId);

        if (index > -1) {

            user.wishlist.splice(index, 1);
            await user.save();
            return res.status(200).json({
                status: 'removed',
                message: "Product removed from wishlist"
            });
        } else {
           
            user.wishlist.push(productId);
            await user.save();
            return res.status(200).json({
                status: 'added',
                message: "Product added to wishlist"
            });
        }


        // if(user.wishlist.includes(productId)){
        //     return res.status(200).json({
        //         status : false,
        //         message : "Product already exist in wishlist"
        //     })
        // }
        // user.wishlist.push(productId);
        // await user.save();
        // return res.status(200).json({
        //     status : true,
        //     message : "Product added to wishlist"
        // })

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status : false,
            message : "Server error"
        })
    }
}

const removeProduct = async (req,res) => {

    try {

        const productId = req.query.productId;
        const sessionUser = req.session.user;
        const user = await User.findById(sessionUser._id);
        const index = user.wishlist.indexOf(productId);
        user.wishlist.splice(index,1);
        await user.save();
        return res.redirect("/wishlist")
        
    } catch (error) {
        return res.status(500).json({status:false,message:"Server error"})
    }
   

}



module.exports = {
    loadWishlist,
    addToWishlist,
    removeProduct,
}