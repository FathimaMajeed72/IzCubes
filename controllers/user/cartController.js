const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema")
const MAX_QUANTITY_LIMIT = 5;
const SHIPPING_FEE = 40;



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
      return res.render('cart', { cartItems: [],subtotal:0,discount:0, total: 0,shipping:0 });
    }


      const cartItems = cart.items.map(item => {
      const product = item.productId;
      const sizeInfo = product.sizes.find(s => s.size === item.size);
      const stockQty = sizeInfo ? sizeInfo.quantity : 0;
      const isInStock = stockQty >= item.quantity;

      const offer = product.productOffer || 0;
      const regularPrice = product.regularPrice;
      const discount = (regularPrice * offer / 100) * item.quantity;

      return {
        _id: item._id,
        product,
        quantity: item.quantity,
        size: item.size,
        totalPrice: item.totalPrice,
        regularPrice,
        offer,
        discount,
        categoryName: product.category ? product.category.name : 'Unknown',
        inStock: isInStock,
        availableStock: stockQty
      };
    });

    const validItems = cartItems.filter(item => item.inStock);

    const subtotal = validItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const discount = validItems.reduce((sum, item) => sum + item.discount, 0);
    const total = subtotal-discount+SHIPPING_FEE;

    res.render('cart', {
      cartItems,
      subtotal,
      discount,
      shipping:SHIPPING_FEE,
      total
    });
  } catch (error) {
    console.error("Error rendering cart:", error);
    res.redirect("/pageNotFound");
  }
};


const addToCart = async (req,res) => {

    try {

        const {productId,selectedSize} = req.body;
        const sessionUser = req.session.user;
        const userId = sessionUser._id;


        const product = await Product.findById(productId).populate('category');
        if (!product) return res.status(404).json({ message: "Product not found" });

        if (product.isBlocked) {
          return res.status(403).json({ message: "This product is unavailable" });
        }

        if (!product.category?.isListed) {
          return res.status(403).json({ message: "This product's category is unavailable" });
        }
     


        const sizeStock = product.sizes.find(s => s.size === selectedSize);
        if (!sizeStock || sizeStock.quantity <= 0) {
          return res.status(400).json({ message: "Selected size out of stock" });
        }

        
        const price = product.salePrice;
        let cart = await Cart.findOne({ userId });

        if (cart) {

              const item = cart.items.find(i =>
                i.productId.toString() === productId && i.size === selectedSize
              );
              if (item) {
                if (item.quantity >= MAX_QUANTITY_LIMIT) {
                  return res.status(400).json({ message: `Max limit of ${MAX_QUANTITY_LIMIT} per item` });
                }
                if (item.quantity + 1 > sizeStock.quantity) {
                  return res.status(400).json({ message: `Only ${sizeStock.quantity} items in stock` });
                }

                item.quantity += 1;
                item.totalPrice = item.quantity * item.price;
              } else {
                cart.items.push({
                  productId,
                  size: selectedSize,
                  quantity: 1,
                  price,
                  totalPrice: price
                });
              }
        } else {
      
        cart = new Cart({
        userId,
        items: [{ productId,size : selectedSize, quantity : 1, price, totalPrice : price }]
        });
    }

    await cart.save();

    await User.findByIdAndUpdate(userId, {
      $pull: { wishlist: productId },
    });
   // res.status(200).json({ message: "Cart updated", cart });
    res.redirect("/cart")

        
    } catch (error) {

       console.error("Add to Cart Error:", error);
       res.redirect("/pageNotFound");
        
    }
    
}


const changeQuantity = async (req,res) => {
  try {
    const { productId, quantity, size } = req.body;
    const userId = req.session?.user?._id;

    if (!userId || !productId || !size || quantity < 1) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    if (quantity > MAX_QUANTITY_LIMIT) {
      return res.status(400).json({
        error: `Maximum ${MAX_QUANTITY_LIMIT} items allowed per product`
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const inStock = product.sizes.find(s => s.size === size);
    if (!inStock) {
      return res.status(400).json({ error: 'Selected size not available' });
    }

    // if (quantity > inStock.quantity) {
    //   return res.status(400).json({ error: `Only ${inStock.quantity} item(s) available for size ${size}` });
    // }

  
    const cart = await Cart.findOne({ userId });

    if (!cart) return res.status(404).json({ error: 'Cart not found' });

   
    const item = cart.items.find(item => item.productId.toString() === productId  &&
      item.size === size);

    if (!item) return res.status(404).json({ error: 'Product not found in cart' });


    if (quantity > item.quantity && quantity > inStock.quantity) {
      return res.status(400).json({
        error: `Only ${inStock.quantity} item(s) available for size ${size}`
      });
    }

    
    item.quantity = quantity;
    item.totalPrice = quantity * item.price;

    
    await cart.save();


    const grandTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    return res.status(200).json({ message: 'Quantity updated', grandTotal });

    
  } catch (error) {
    console.error('Error updating cart quantity:', error);
    res.status(500).json({ error: 'Server error' });
  }
  
}


const deleteProduct = async (req,res) => {

  const productId = req.query.id;
  const size = req.query.size;
  const userId = req.session?.user?._id;

  if (!userId || !productId|| !size) {
    return res.redirect('/cart');
  }

  try {
    const updatedCart = await Cart.findOneAndUpdate(
      { userId },
      { $pull: { items: { productId ,size} } },
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