const User = require("../../models/userSchema")
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema")



const productDetails = async (req, res) => {
    try {
      const userId = req.session.user;
      const userData = await User.findById(userId);
      const productId = req.query.id;
      const from = req.query.from || "shop";
  
      if (!productId) {
        return res.redirect('/pageNotFound');
      }
  
      const product = await Product.findById(productId).populate('category');
      if (!product) {
        return res.redirect('/pageNotFound');
      }
  
      const findCategory = product.category;
      const categoryOffer = findCategory?.categoryOffer || 0;
      const productOffer = product.productOffer || 0;
      const totalOffer = categoryOffer + productOffer;
  
      const similarProducts = await Product.find({
        category: product.category._id,
        _id: { $ne: product._id },
      }).limit(4);


      const totalStock = product.sizes.reduce((sum, item) => sum + item.quantity, 0);

      
      res.render('product-details', {
        user: userData,
        product: product,
        quantity: product.quantity,
        totalStock,
        totalOffer: totalOffer,
        category: findCategory,
        similarProducts: similarProducts,
        from,
      });
  
    } catch (error) {
      console.error("Error in productDetails:", error);
      res.redirect('/pageNotFound');
    }
  };

module.exports = {productDetails}