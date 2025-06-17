const User=require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema')
const nodemailer=require('nodemailer');
const bcrypt=require('bcrypt');
const env=require('dotenv').config();
const session=require('express-session');
const fs = require("fs");
const path = require("path");


function generateOtp(){
    const digits="1234567890";
    let otp="";
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)];
    }
    return otp;
}



const sendVerificationEmail= async (email,otp)=>{
    try {
        const transporter=await nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const mailOptions ={
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"your otp for password reset",
            text:`Your OTP is ${otp}`,
            html:`<b><h4>Your OTP ${otp}<br></h4></b>`
        }
        const info=await transporter.sendMail(mailOptions);
        console.log("Email send",info.messageId);
        return true;

    } catch (error) {
        console.log("Error sending email", error);
        return false;
    }
}


const securePassword = async (password)=>{
    try {
      const passwordHash = await bcrypt.hash(password,10);
      return passwordHash;
    } catch (error) {
      
    }
  }


const getForgotPasswordPage = async (req,res)=>{
    try {
        res.render('forgot-password');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}


const forgotEmailValid = async(req,res)=>{
    try {
        const {email}=req.body;
        const findUser =  await User.findOne({email:email});
        if(findUser){
            const otp=generateOtp();
            const emailSent=await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp=otp;
                req.session.email=email;
                res.render("forgotpass-otp");
                console.log("OTP :",otp);
            }else{
                res.json({success:false,message:"Failed to send otp ,please try again"});
            }
        }else{
            res.render('forgot-password',{
                message:"user with this email does not exist"
            });
        }
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}

const verifyForgotpassOtp = async (req, res) => {
    try {
      const enteredOtp = req.body.otp;
      if (enteredOtp === req.session.userOtp) {
        res.json({ success: true, redirectUrl: "/reset-password" });
      } else {
        res.json({ success: false, message: "OTP not matching" });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: "An error occured. Please try again" });
    }
  };


  const getResetPassPage=async (req,res)=>{
    try {
        res.render('reset-password');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}


const resendOtp = async (req, res) => {
    try {
      console.log("OTP Resend Called");
      const otp = generateOtp();
      req.session.userOtp = otp;
      const email = req.session.email;
  
      if (!email) {
        console.log("Email not in session");
        return res.status(400).json({ success: false, message: 'Email not found in session' });
      }
  
      console.log("Sending OTP to:", email);
      console.log("otp resend:",otp);
      
  
      const emailSent = await sendVerificationEmail(email, otp);
      console.log("Email sent status:", emailSent);
  
      if (emailSent) {
        return res.status(200).json({ success: true, message: "OTP resent successfully" });
      } else {
        return res.status(500).json({ success: false, message: "Failed to send OTP" });
      }
    } catch (error) {
      console.error("Error in resendOtp:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  };
  


const postNewPassword = async (req,res)=>{
    try {
      const {newPass1,newPass2}=req.body;
      const email = req.session.email;
      if(newPass1 === newPass2){
        const passwordHash = await securePassword(newPass1);
        await User.updateOne({email:email},{$set:{password:passwordHash}})
        res.redirect('/login?passwordChanged=true');
      }else{
        res.render('reset-password',{message:"passwords do not match"})
      }
  
    } catch (error) {
      res.redirect('/pageNotFound');
    }
  }


  const userProfile = async (req,res)=>{
    try {
      const userId = req.session.user._id;
      const tab = req.query.tab || 'profile';

      const userData = await User.findById(userId);
       
      const addressData = await Address.findOne({userId:userData._id})

      const query = req.query.query || '';
      
      const page = parseInt(req.query.page) || 1;
      const perPage = 3;

     
      const orderQuery = {
        user: userId,
        ...(query ? { orderId: { $regex: query, $options: 'i' } } : {}) 
      };

      let allOrders = await Order.find(orderQuery)
      .sort({ createdOn: -1 })
      .populate('orderedItems.product');


      

      const totalCount = allOrders.length;
      const totalPages = Math.ceil(totalCount / perPage);

       const paginatedOrders = allOrders.slice((page - 1) * perPage, page * perPage);

      const userAddresses = addressData ? addressData.address : [];


      console.log("userAddresses array:", userAddresses);


      res.render("profile",{
        user : userData,
        userAddresses,
        orders: paginatedOrders,
        tab,
        query: query,
        totalPages,
        currentPage: page
      })
      
    } catch (error) {
      
      console.error("Error in retrieving profile data",error);
      res.redirect("/pageNotFound")

    }
  }

  const editProfile = async (req,res) => {

    try {
    const userId = req.query.id;
    const { name, phone, removeImage } = req.body;

    const updateData = {
      name,
      phone
    };

    
   
    const user = await User.findById(userId);

    
    if (removeImage === "true" && user.profileImage) {
      const existingImagePath = path.join('public', user.profileImage);
      if (fs.existsSync(existingImagePath)) {
        fs.unlinkSync(existingImagePath);
      }
      updateData.profileImage = "/img/defaultProfileImage.jpg"; 
    }

    
    if (req.file) {
      const newImagePath = `/uploads/re-image/${req.file.filename}`;

      
      if (user.profileImage && fs.existsSync(path.join('public', user.profileImage))) {
        fs.unlinkSync(path.join('public', user.profileImage));
      }

      updateData.profileImage = newImagePath;
    }

    await User.findByIdAndUpdate(userId, updateData);

    res.redirect('/userProfile'); 

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).send('Something went wrong');
  }
    
  }


const changeEmail = async (req,res) => {
  try {

    res.render("change-email")
    
  } catch (error) {
    
    res.redirect("/pageNotFound")

  }
} 



const changeEmailValidation = async (req, res) => {
  try {
    const { currentEmail, newEmail } = req.body;
    const userId = req.session.user?._id;

    if (!currentEmail || !newEmail) {
      return res.render("change-email", { message: "Both email fields are required." });
    }

    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.redirect("/login"); 
    }

    if (currentUser.email !== currentEmail) {
      return res.render("change-email", { message: "Current email is incorrect." });
    }

    const emailExists = await User.findOne({ email: newEmail });
    if (emailExists) {
      return res.render("change-email", { message: "New email is already in use." });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(newEmail, otp);

    if (emailSent) {
      req.session.userOtp = otp;
      req.session.email = newEmail;
      console.log(otp)
      return res.render("change-email-otp"); 
    } else {
      return res.render("change-email", { message: "Failed to send OTP. Please try again." });
    }
  } catch (error) {
    console.error("Error in changeEmailValidation:", error);
    return res.redirect("/pageNotFound");
  }
};



const verifyEmailOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const sessionOtp = req.session.userOtp;
    const newEmail = req.session.email;
    const userId = req.session.user?._id;

  if (!sessionOtp || !newEmail) {
    return res.redirect("/change-Email");
  }

  if (otp === sessionOtp) {
    const userId = req.session.user._id;
    await User.findByIdAndUpdate(userId, { email: newEmail });

    
    req.session.user.email = newEmail;
    delete req.session.userOtp;
    delete req.session.pendingEmail;

    return res.redirect("/userProfile?emailVerified=true&emailUpdated=true"); 
  } else {
    return res.render("change-email-otp", { message: "Incorrect OTP. Please try again." });
  }
  } catch (error) {

    console.error("Error in verifying email otp:", error);
    return res.redirect("/pageNotFound");
    
  }
  
};


const getChangePassword =async (req,res) => {
  try {

    res.render('change-password');

  } catch (error) {

    res.redirect('/pageNotFound');

  }
  
}

const postChangePassword =async (req,res) => {
  try {
    const {oldPass,newPass1,newPass2}=req.body;
    const userId = req.session.user?._id;

    if (!userId) {
      return res.redirect('/login');
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect('/login');
    }

    const isMatch = await bcrypt.compare(oldPass, user.password);
    if (!isMatch) {
      return res.render('change-password', { message: "Old password is incorrect" });
    }
if (newPass1 !== newPass2) {
      return res.render('change-password', { message: "New passwords do not match" });
    }

    const passwordHash = await securePassword(newPass1);
    await User.updateOne({ _id: userId }, { $set: { password: passwordHash } });

    
    req.session.destroy(err => {
      if (err) {
        console.error("Session destroy error:", err);
        return res.redirect('/userprofile');
      }
      res.redirect('/login?passwordChanged=true');
    });

  
  } catch (error) {
    res.redirect('/pageNotFound');
  }
  
}





const addAddress = async (req,res) => {
  try {
    
      const user = req.session.user;
      const from = req.query.from
      
      res.render("add-address",{user:user,from})

  } catch (error) {
    res.redirect("/pageNotFound")
  }
}

const postAddAddress = async (req,res) => {
  try {

    const user = req.session.user;
    
    //const userData = await User.findOne({_id:user._id});
    const {addressType,name,houseName,streetName,city,landMark,state,pincode,phone,altPhone,isDefault} = req.body;
    const from = req.body.from || 'profile';
    
    let userAddress = await Address.findOne({userId : user._id})
    const newAddress = { addressType, name, houseName, streetName, city, landMark, state, pincode, phone, altPhone, isDefault: !!isDefault };

    if (!userAddress) {
      userAddress = new Address({
        userId: user._id,
        address: [newAddress],
      });
      await userAddress.save();
    } else {

      if (newAddress.isDefault) {
        userAddress.address.forEach(addr => addr.isDefault = false);
      }
      userAddress.address.push(newAddress);
      await userAddress.save();
    }

    
    const addresses = await Address.find({ userId:user._id});
    const orders = await Order.find({ userId:user._id }).sort({ createdAt: -1 });


    const userAddresses = userAddress.address;

      if (from === 'checkout') {
        return res.redirect('/checkout');
      } else {
        //   res.render("profile", {
        //   user,
        //   userAddresses,
        //   orders,
        // });
        res.redirect("/userProfile#addressSection")
      }
    

  } catch (error) {

    console.error("Error on adding address",error);
    res.redirect("/pageNotFound");
    
  }
}





const postEditAddress = async (req,res) => {
  try {

    const data = req.body;
    const addressId = req.query.id;
    const user = req.session.user;
    const section = req.query.section || 'profileSection';
    const findAddress = await Address.findOne({"address._id":addressId})
    if(!findAddress){
      res.redirect("/pageNotFound");
    }

    const setAsDefault = !!data.isDefault; 
    if (setAsDefault) {
      findAddress.address.forEach(addr => {
        addr.isDefault = addr._id.toString() === addressId;
      });
    }

    await Address.updateOne(
      {"address._id" : addressId},
      {$set : {
        "address.$" : {
          _id : addressId,
          addressType : data.addressType,
          name : data.name,
          houseName : data.houseName,
          streetName : data.streetName,
          landMark : data.landMark,
          city : data.city,
          pincode : data.pincode,
          state : data.state,
          phone : data.phone,
          altPhone : data.altPhone,
          isDefault : setAsDefault
        }
      }}
    )

    
    if (setAsDefault) {
      await findAddress.save(); 
    }

    res.redirect(`/userProfile#${section}`);


  } catch (error) {
    
    console.error("Error in edit address",error);
    res.redirect("/pageNotFound")

  }
}


const deleteAddress = async (req,res) => {
  try {
    const userId = req.session.user?._id;
    const addressId = req.query.id||req.body.id;

    console.log("User ID:", userId);
    console.log("Address ID:", req.query.id);

    console.log("Original URL:", req.originalUrl);
    console.log("Query object:", req.query);


    const findAddress = await Address.findOne({
      userId,
      "address._id": addressId
    });

    if (!findAddress) {
      return res.status(404).send("Address not found");
    }

   
    await Address.updateOne(
      { userId },
      { $pull: { address: { _id: addressId } } }
    );

    res.redirect("/userProfile"); 
  } catch (error) {
    console.error("Error in delete address", error);
    res.redirect("/pageNotFound");
  }
}


module.exports ={
    getForgotPasswordPage,
    forgotEmailValid,
    verifyForgotpassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    editProfile,
    changeEmail,
    changeEmailValidation,
    verifyEmailOtp,
    getChangePassword,
    postChangePassword,
    addAddress,
    postAddAddress,
    postEditAddress,
    deleteAddress,
}