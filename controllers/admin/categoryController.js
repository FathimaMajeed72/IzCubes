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
    console.log("Received data:", name, description); 
    try {
        const existingCategory = await Category.findOne({name});
        if(existingCategory){
            console.log("Category already exists");
            return res.status(400).json({error:"Category already exists"})
        }
        const newCategory = new Category({
            name,
            description,
        })
        await newCategory.save();
        console.log("Category saved successfully");

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
        const existingCategory = await Category.findOne({name:categoryName})
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
            res.status(400).json({error:"Category not found"})
        }

    } catch (error) {
        res.status(500).json({error:"Internal Server Error"})
    }
}



module.exports={
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
}