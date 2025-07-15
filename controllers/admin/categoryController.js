const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema")



const categoryInfo =async (req,res) => {
    try {


        let search ="";
        if(req.query.search){
            search = req.query.search;
        }

        const page = parseInt(req.query.page) || 1;
        const limit =4;
        const skip = (page-1)*limit;

        const categoryData = await Category.find({name:{$regex:".*"+search+".*",$options:"i"}})
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit);


        const totalCategories = await Category.countDocuments({name:{$regex:".*"+search+".*",$options:"i"}});
     
        const totalPages = Math.ceil(totalCategories/limit)
        res.render("category",{
            cat : categoryData,
            currentPage : page,
            totalPages : totalPages,
            totalCategories : totalCategories,
            search
        })

    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound")
        
    }
}


const addCategory = async (req,res) => {
    const {name,description} = req.body
   
    try {
        const existingCategory = await Category.findOne({
            name: { $regex: `^${name}$`, $options: 'i' },
        });
        if(existingCategory){
          
            return res.status(400).json({error:"Category already exists"})
        }
        const newCategory = new Category({
            name,
            description,
        })
        await newCategory.save();
        

        return res.json({
            message:"Category added succesfully",
            alert: {
            title: "Success",
            text: "Category added successfully!",
            icon: "success"
          }})
    } catch (error) {
        console.error("Error in addCategory:", error);
        return res.status(500).json({error:"Internal Server Error"})
    }
}





const getListCategory = async (req,res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:false}})
        res.redirect("/admin/category")
    } catch (error) {
        res.redirect("/pageerror")
    }
}



const getUnlistCategory = async (req,res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:true}}) 


        res.redirect("/admin/category")
    } catch (error) {
        res.redirect("/pageerror")
    }
    
} 



const getEditCategory = async (req,res) => {
    try {
        const id = req.query.id;
        const category = await Category.findOne({_id:id});
        res.render("edit-category",{category:category})
    } catch (error) {
        res.redirect("/pageerror")
    }
}

const editCategory = async (req,res) => {
    try {

        const id = req.params.id;
        const {categoryName,description} = req.body
        const existingCategory = await Category.findOne({
             name: { $regex: new RegExp(`^${categoryName}$`, "i") },
            _id: { $ne: id }
        });
        if(existingCategory){
            return res.status(400).json({error:"Category exists, please choose another name"})
        }

        const updateCategory = await Category.findByIdAndUpdate({_id:id},{
            name : categoryName,
            description : description,
        },{new : true});

        if(updateCategory){
            res.redirect("/admin/category");
        }else{
            res.status(404).json({error:"Category not found"})
        }

    } catch (error) {
        res.status(500).json({error:"Internal Server Error"})
    }
}


const addCategoryOffer = async (req, res) => {
  try {
    const { categoryId, percentage } = req.body;
    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    category.categoryOffer = parseInt(percentage);
    await category.save();

    const products = await Product.find({ category: category._id });

    for (const product of products) {
      const maxOffer = Math.max(product.productOffer || 0, percentage);
      product.salePrice = Math.floor(product.regularPrice - (product.regularPrice * maxOffer) / 100);
      await product.save();
    }

    return res.json({ status: true });
  } catch (error) {
    console.error("addCategoryOffer error:", error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};


const removeCategoryOffer = async (req, res) => {
  try {
    const { categoryId } = req.body;
    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    const products = await Product.find({ category: category._id });

    for (const product of products) {
      const offer = product.productOffer || 0;
      product.salePrice = offer > 0
        ? Math.floor(product.regularPrice - (product.regularPrice * offer) / 100)
        : product.regularPrice;
      await product.save();
    }

    category.categoryOffer = 0;
    await category.save();

    return res.json({ status: true });
  } catch (error) {
    console.error("removeCategoryOffer error:", error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};





module.exports={
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
    addCategoryOffer,
    removeCategoryOffer
}