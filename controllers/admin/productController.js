const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema")
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");


const getProductAddPage = async (req,res) => {
    try {

        const category = await Category.find({isListed:true});
        const brand = await Brand.find({isBlocked:false});
        res.render("product-add",{
            cat:category,
            brand:brand,
        });
        
    } catch (error) {
        res.redirect("/admin/pageerror")
    }    
}

const addProducts = async (req,res) => {
    try {
        
        const products = req.body;
        const normalized = products.productName.trim().toLowerCase();
        const productExists =   await Product.findOne({
            productName: { $regex: new RegExp("^" + normalized + "$", "i") },

        });

        if(!productExists){
            const images = [];
            if(req.files && req.files.length>0){
                for(let i=0;i<req.files.length;i++){
                    const originalImagePath =req.files[i].path;

                    const resizedImagePath = path.join('public','uploads','product-images',req.files[i].filename)
                    await sharp(originalImagePath).resize({width:440,height:440}).toFile(resizedImagePath);
                    images.push(req.files[i].filename)
                }
            }
            const categoryId = await Category.findOne({name:products.category})

            if(!categoryId){
                return res.status(400).json("Invalid category name");
            }

            const parsedSizes = products.sizes.map(s => {
                if (!s.size || s.quantity === undefined) {
                    throw new Error("Size and quantity must be provided for all size entries.");
                }
                return {
                    size: s.size,
                    quantity: parseInt(s.quantity)
                };
            })

            let regularPrice = parseFloat(products.regularPrice);
            let salePrice = parseFloat(products.salePrice);

            let productOffer = ((regularPrice - salePrice) / regularPrice) * 100;

            const newProduct = new Product({
                productName : products.productName,
                description : products.description,
                brand : products.brand,
                category : categoryId._id,
                regularPrice : products.regularPrice,
                salePrice : products.salePrice,
                productOffer : productOffer,
                createdOn : new Date(),
                sizes: parsedSizes,
                color : products.color,
                productImage : images,
                status : 'Available',
            });

            await newProduct.save();
            return res.redirect("/admin/addProducts?success=true")
          
        }else{
            return res.status(400).json("Product already exist, please try with another name");

        }   

    } catch (error) {
        console.error("Error saving product",error);
        return res.redirect("/admin/pageerror")
    }
}

const getAllProducts = async (req,res) => {
    try {
        
        const search = req.query.search || "";
        const page = req.query.page || 1;
        const limit = 4;

        const productData = await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
                {brand:{$regex:new RegExp(".*"+search+".*","i")}},
            ],
        }).sort({ createdAt: -1 }).limit(limit*1).skip((page-1)*limit).populate('category').exec();

        const count = await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
                {brand:{$regex:new RegExp(".*"+search+".*","i")}},
            ],
        }).countDocuments();

        const category =await Category.find({isListed:true});
        const brand = await Brand.find({isBlocked:false});

        if(category && brand){
            res.render("products",{
                data : productData,
                currentPage : page,
                totalPages : Math.ceil(count/limit),
                cat : category,
                brand : brand
            })
        }else{
            res.render("admin-error")
        }

    } catch (error) {
        res.redirect("/admin/pageerror")
    }
}


const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;
    const findProduct = await Product.findById(productId).populate("category");

    if (!findProduct) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    if (findProduct.category.categoryOffer > percentage) {
      return res.json({
        status: false,
        message: `This product's category already has a higher offer (${findProduct.category.categoryOffer}%)`,
      });
    }

    findProduct.productOffer = parseInt(percentage);
    const maxOffer = Math.max(findProduct.productOffer, findProduct.category.categoryOffer || 0);
    findProduct.salePrice = Math.floor(findProduct.regularPrice - (findProduct.regularPrice * maxOffer) / 100);

    await findProduct.save();
    return res.json({ status: true });
  } catch (error) {
    console.error("addProductOffer error:", error);
    res.redirect("/admin/pageerror");
  }
};


  
const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    const findProduct = await Product.findById(productId).populate("category");

    if (!findProduct) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    findProduct.productOffer = 0;
    const categoryOffer = findProduct.category.categoryOffer || 0;

    findProduct.salePrice = categoryOffer > 0
      ? Math.floor(findProduct.regularPrice - (findProduct.regularPrice * categoryOffer) / 100)
      : findProduct.regularPrice;

    await findProduct.save();
    return res.json({ status: true });
  } catch (error) {
    console.error("removeProductOffer error:", error);
    res.redirect("/admin/pageerror");
  }
};

  
  const blockProduct = async (req,res)=>{
    try {
      let id = req.query.id;
      await Product.updateOne({_id:id},{$set:{isBlocked:true}});
      res.redirect('/admin/products');
    } catch (error) {
      res.redirect('/admin/pageerror');
    }
  }
  
  const unblockProduct = async (req,res)=>{
    try {
      let id = req.query.id;
      await Product.updateOne({_id:id},{$set:{isBlocked:false}});
      res.redirect('/admin/products'); 
    } catch (error) {
      res.redirect('/admin/pageerror');
    }
  }


const getEditProduct =async (req,res) => {
  try {
    const id = req.query.id;

    const product = await Product.findById(id);
    //console.log("Fetched product:", product);
    const invertoryIndex = product.sizes.length;
    const category = await Category.find();
    const brand = await Brand.find();

    res.render('product-edit', {
      cat:category,
      product:product,
      brand:brand,
      invertoryIndex
    });
    
  } catch (error) {
    console.log("Edit Product Error:", error);
    res.redirect('/admin/pageerror');
  }
}


const editProduct = async (req,res) => {
  try {

    const id = req.params.id;
    const product = await Product.findOne({_id:id});
    const data = req.body;
    const existingProduct = await Product.findOne({
      productName : data.productName,
      _id:{$ne:id}
    })

    if(existingProduct){
      return res.status(400).json({error:"Product with this name already exists. please try with another name"})
    }

    const sizes = Object.values(data.sizes || {}).map(entry => ({
      size: entry.size,
      quantity: parseInt(entry.quantity, 10)
    }));

    const images = [];
    if(req.files && req.files.length>0){
      for(let i=0;i<req.files.length;i++){
        images.push(req.files[i].filename)
      }
    }
  

    const updateFields = {
        productName:data.productName,
        description:data.description,
        brand:data.brand,
        category:data.category,
        regularPrice:data.regularPrice,
        salePrice:data.salePrice,
        sizes:sizes,
        color:data.color,
    }
    if(req.files.length>0){
      updateFields.$push={productImage:{$each:images}}
    }
    await Product.findByIdAndUpdate(id,updateFields,{new:true});
    res.redirect("/admin/products")
  } catch (error) {
    console.error(error);
    res.redirect("/admin/pageerror")
    
  }
  
}

const deleteSingleImage= async (req,res) => {
  try {
    const {imageNameToServer,productIdToServer} = req.body;
    const product = await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToServer}})
    const imagePath = path.join("public","uploads","re-image",imageNameToServer)
    if(fs.existsSync(imagePath)){
      await fs.unlinkSync(imagePath);
      console.log(`Image ${imageNameToServer} deleted successfully`);
      }else{
        console.log(`Image ${imageNameToServer} not found`);
      }
      res.send({status:true})

  } catch (error) {
      res.redirect("/admin/pageerror")
  }
}



module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
}