const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema")




const getCartPage = async (req, res) => {
  try {
    const sessionUser = req.session.user;
    const userId = sessionUser._id;
   
     const cart = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: {
          path: 'category',
          model: 'Category'
        }
      });

    if (!cart || cart.items.length === 0) {
      return res.render('cart', { cartItems: [], total: 0 });
    }


    const cartItems = cart.items.map(item => ({
      _id: item._id,
      product: item.productId,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      categoryName: item.productId.category ? item.productId.category.name : 'Unknown'
    }));

    const total = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    res.render('cart', {
      cartItems,
      total
    });
  } catch (error) {
    console.error("Error rendering cart:", err);
    res.redirect("/pageNotFound");
  }
};


const addToCart = async (req,res) => {

    try {

        const {productId,quantity} = req.body;
        const sessionUser = req.session.user;
        const userId = sessionUser._id;


        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: "Product not found" });

        const qty = parseInt(quantity) || 1;
        const price = product.salePrice;
        const totalPrice = price * qty;

        let cart = await Cart.findOne({ userId });

        if (cart) {
              const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

              if (itemIndex > -1) {
              cart.items[itemIndex].quantity += qty;
              cart.items[itemIndex].totalPrice += totalPrice;
              } else {
        
              cart.items.push({ productId, quantity:qty, price, totalPrice });
              }
        } else {
      
        cart = new Cart({
        userId,
        items: [{ productId, quantity : qty, price, totalPrice }]
        });
    }

    await cart.save();
   // res.status(200).json({ message: "Cart updated", cart });
    res.redirect("/cart")

        
    } catch (error) {

       console.error("Add to Cart Error:", error);
       res.redirect("/pageNotFound");
        
    }
    
}


const changeQuantity = async (req,res) => {

  const { productId, quantity } = req.body;
  const userId = req.session?.user?._id;

  if (!userId || !productId || quantity < 1) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const cart = await Cart.findOne({ userId });

    if (!cart) return res.status(404).json({ error: 'Cart not found' });

   
    const item = cart.items.find(item => item.productId.toString() === productId);

    if (!item) return res.status(404).json({ error: 'Product not found in cart' });

    
    item.quantity = quantity;
    item.totalPrice = quantity * item.price;

    
    await cart.save();


    const grandTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    res.redirect('/cart');

    
  } catch (error) {
    console.error('Error updating cart quantity:', error);
    res.status(500).json({ error: 'Server error' });
  }
  
}


const deleteProduct = async (req,res) => {

  const productId = req.query.id;
  const userId = req.session?.user?._id;

  if (!userId || !productId) {
    return res.redirect('/cart');
  }

  try {
    const updatedCart = await Cart.findOneAndUpdate(
      { userId },
      { $pull: { items: { productId } } },
      { new: true }
    );


    res.redirect('/cart');
  } catch (err) {
    console.error('Error removing item:', err);
    res.redirect('/cart');
  }
  
}


module.exports = {
    getCartPage,
    addToCart,
    deleteProduct,
    changeQuantity

}