const User = require("../../models/userSchema")
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema")
const Brand = require("../../models/brandSchema")
const env = require("dotenv").config()
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")

const pageNotFound = async (req,res) => {
    try {

        res.render("page-404")
        
    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong");
    }
    
}



const loadHomepage = async (req,res) => {
    try{

        let user = req.session.user;
        const categories = await Category.find({isListed:true})
        let productData = await Product.find({
            isBlocked:false,
            category:{$in:categories.map(category=>category._id)},
            //quantity:{$gt:0}
        }).sort({createdAt:-1}).limit(4)

       // productData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
       // productData=productData.slice(0,4);

        
        if(user){
            const userData = await User.findOne({_id:user._id});
            console.log(userData)
            res.render("home",{user:userData,products:productData});
        }else{
            return res.render("home",{products:productData});
        }

    }catch(error){
        console.log("Home Page not found");
        res.status(500).send("Server error");
    }
}


const loadSignup = async (req,res) => {
    try {
        
            return res.render("signup");

    } catch (error) {
        
        console.log("Signup Page not found");
        res.status(500).send("Server error");

    }
}


// const signup = async (req,res) => {

//     const {name,email,phone,password} = req.body;

//     try {

//         const newUser = new User({name,email,phone,password})

//         await newUser.save();

//         res.redirect("/signup")
        
//     } catch (error) {

//         console.log("Error for save user",error);
//         res.status(500).send("Internal Server Error");
        
//     }
    
// }

function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

async function sendVerificationEmail(email,otp) {
    try {
        const transporter = nodemailer.createTransport({
            service : 'gmail',
            port : 587,
            secure : false,
            requireTLS : true,
            auth : {
                user : process.env.NODEMAILER_EMAIL,
                pass : process.env.NODEMAILER_PASSWORD
            }
        })

       const info = await transporter.sendMail({
        from : process.env.NODEMAILER_EMAIL,
        to : email,
        subject : "Verify your account",
        text : `Your OTP is ${otp}`,
        html : `<b>Your OTP: ${otp}</b>`
       }) 

       return info.accepted.length > 0;
    } catch (error) {
        console.error("Error Sending Email",error);
        return false;

    }
}

const signup = async (req,res) => {
    try {
        const {name,phone,email,password,cpassword} = req.body;
        console.log(req.body);
        
        if(password !== cpassword){
            return res.render("signup",{message:"Password do not match"})
        }

        const findUser = await User.findOne({email});
        if(findUser){
            return res.render("signup",{message:"User with this email already exists"})
        }

        const otp = generateOtp();

        const emailSent = await sendVerificationEmail(email,otp)

        if(!emailSent){
            return res.json("email-error")
        }

        req.session.userOtp = otp;
        req.session.userData = {name,phone,email,password}

        res.render("verify-otp")
        console.log("OTP Sent",otp);
        

    } catch (error) {

        console.error("signup error",error);
        res.redirect("/pageNotFound")
    
    }
}


const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password,10);

        return passwordHash;
        
    } catch (error) {
        
    }
}

const verifyOtp = async (req,res) => {
    try {
        const {otp} = req.body;
        console.log("OTP entered:",otp);

        if(otp === req.session.userOtp){
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            //to avoid saving the same user after refreshing the otp page after already succesful registration
            const existingUser = await User.findOne({ email: user.email });
            if (existingUser) {
                return res.status(400).json({ success: false, message: "User already exists" });
            }


            const saveUserData = new User({
                name : user.name,
                email : user.email,
                phone : user.phone,
                password : passwordHash,
            })


            await saveUserData.save();
            //req.session.user =saveUserData._id;
            
            console.log("User after OTP:", saveUserData); 
            res.json({ success: true, redirectUrl: "/login?message=Signup%20successful%2C%20please%20log%20in" });
            //res.json({success:true,redirectUrl:"/"})
        }else{
            res.status(400).json({success:false,message:"Invalid OTP, Please try again"})
        }
        
    } catch (error) {
        
        console.error("Error verifying OTP",error)
        res.status(500).json({success:false,message:"An error occured"})

    }
}



const resendOtp = async (req,res) => {
    try {
        
           const {email} = req.session.userData; 
           if(!email){
            return res.status(400).json({success:false,message : "Email not found in session"})
           }

           const otp = generateOtp();
           req.session.userOtp = otp;

           const emailSent = await sendVerificationEmail(email,otp)
           if(emailSent){
            console.log("Resend OTP:",otp);
            res.status(200).json({success:true,message:"OTP Resend successfully"})
           }else{
            res.status(500).json({success:false,message:"Failed to resend OTP. please try again"})
           }

    } catch (error) {
        
        console.error("Error resending OTP",error);
        res.status(500).json({success:false,message:"Internal Server Error. Please try again"})

    }
}


const loadLogin = async (req,res) => {
    try {

        const message = req.query.message || "";

        if(!req.session.user&&!req.user){
            
            return res.render("login",{message})
        }else{
            res.redirect("/")
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


const login = async (req,res) => {
    try {
        const {email,password} = req.body;

        if (!email || !password) {
            return res.render("login", {
                message: "Email and password are required",
            });
        }

        const emailPattern = /^[a-zA-Z0-9._-]+@([a-zA-Z0-9.-]+)\.([a-zA-Z]{2,4})$/;
        if (!emailPattern.test(email)) {
            return res.render("login", {
                message: "Invalid email format",
            });
        }
        

        const findUser = await User.findOne({isAdmin:0,email:email});

        if(!findUser){
            
          
           return res.render("login",{message:"User not found"})
        }
        if(findUser.isBlocked){
            
           
            return res.render("login",{message:"User is blocked by admin"})
        }
        
        const passwordMatch = await bcrypt.compare(password,findUser.password);

        if(!passwordMatch){
            
            
            return res.render("login",{message:"Incorrect password"})
        }

        req.login(findUser, (err) => {
            if (err) {
                console.error("Passport login error:", err);
                return next(err);
            }

            //console.log(findUser)
            req.session.user = findUser;
            res.redirect("/")
        });


    } catch (error) {
        console.error("login error ",error); 
        
        
        return res.render("login",{message:"Login failed. Please try again later"})
    }
}


const logout = async (req,res) => {
    try {

        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error ",err.message);
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/login")
        })
        
    } catch (error) {
        console.log("Logout error ",error);
        res.redirect("/pageNotFound")
        
    }
}



const loadShoppingPage = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = user ? await User.findById(user._id) : null;


    const search = req.query.search || "";
    const selectedCategory = req.query.category || null;
    const selectedBrand = req.query.brand || null;
    const priceGreaterThan = parseFloat(req.query.gt);
    const priceLesserThan = parseFloat(req.query.lt);
    const sortType = req.query.sortType || "default";

    const categories = await Category.find({ isListed: true });
    const categoryIds = categories.map(cat => cat._id.toString());

    const brands = await Brand.find({ isBlocked: false }).lean();

    
    const productQuery = {
      isBlocked: false,
      category: { $in: categoryIds }
    };


    if (search.trim()) {
      productQuery.productName = { $regex: search.trim(), $options: "i" };
    }

    
    if (selectedCategory && categoryIds.includes(selectedCategory)) {
      productQuery.category = selectedCategory;
    }

    
    if (selectedBrand) {
      const brandDoc = await Brand.findById(selectedBrand);
      if (brandDoc) {
        productQuery.brand = brandDoc.brandName;
      }
    }

    if (!isNaN(priceGreaterThan) && !isNaN(priceLesserThan)) {
      productQuery.salePrice = { $gt: priceGreaterThan, $lte: priceLesserThan };
    }


    let sortQuery = {};
    switch (sortType) {
      case "lowToHigh": sortQuery = { salePrice: 1 };
                        break;
      case "highToLow": sortQuery = { salePrice: -1 };
                        break;
      case "AaToZz"   : sortQuery = { productName: 1 };
                        break;
      case "ZzToAa"   : sortQuery = { productName: -1 };
                        break;
      default         : sortQuery = { createdAt: -1 };
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    const [products, totalProducts] = await Promise.all([
      Product.find(productQuery).sort(sortQuery).skip(skip).limit(limit).lean(),
      Product.countDocuments(productQuery)
    ]);

    const totalPages = Math.ceil(totalProducts / limit);
    const categoriesWithIds = categories.map(c => ({ _id: c._id, name: c.name }));

    res.render("shop", {
      user: userData,
      products,
      category: categoriesWithIds,
      brand: brands,
      totalProducts,
      currentPage: page,
      totalPages,
      search,
      selectedCategory,
      selectedBrand,
      priceGreaterThan,
      priceLesserThan,
      sortType
    });

  } catch (error) {
    console.error(error);
    res.redirect("/pageNotFound");
  }
};






module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    loadShoppingPage,
    
}