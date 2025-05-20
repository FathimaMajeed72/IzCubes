const User=require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const nodemailer=require('nodemailer');
const bcrypt=require('bcrypt');
const env=require('dotenv').config();
const session=require('express-session');


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
      const userData = req.session.user;
      res.render("profile",{
        user:userData,
      })
      
    } catch (error) {
      
      console.error("Error in retrieving profile data",error);
      res.redirect("/pageNotFound")

    }
  }


const changeEmail = async (req,res) => {
  try {

    res.render("change-email")
    
  } catch (error) {
    
    res.redirect("/pageNotFound")

  }
} 


const changeEmailValidation = async (req,res) => {
  try {

    const {email} = req.body;
    const user = await User.findOne({email});
    if(user){
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email,otp);
      if(emailSent){
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = email;
        res.render("change-email-otp");
        console.log("Email sent to :",email);
        console.log("OTP : ",otp);
        
      }else{
        res.json("email-error")
      }
    }else{
      res.render("change-email",{message : "User with this email does not exist!!"})
    }
     
    
  } catch (error) {
    
    res.redirect("/pageNotFound")

  }
} 



const verifyEmailOtp = async (req,res) => {
  try {

    const enteredOtp = req.body.otp;
    if(enteredOtp===req.session.userOtp){
      req.session.userData = req.body.userData;
      res.render("new-email",{
        userData : req.session.userData
      })
    }else{
      res.render("change-email-otp",{
        message : "OTP not matching",
        userData : req.session.userData
      })
    }
    
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}

const updateEmail = async (req,res) => {
  try {

    const newEmail = req.body.newEmail;
    const user = req.session.user;
     if (user && user._id) {
     
      await User.findByIdAndUpdate(user._id, { email: newEmail });

      const updatedUser = await User.findById(user._id);
      req.session.user = updatedUser;

      res.redirect("/userProfile");
    } else {
      res.redirect("/login");
    }
    
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}


const changePassword = async (req,res) => {
  try {

    res.render("change-password")
    
  } catch (error) {
    
    res.redirect("/pageNotFound")

  }
} 

const changePasswordValid = async (req,res) => {
  try {

    const {email} = req.body;

    const user = await User.findOne({email});
    if(user){
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email,otp);
      if(emailSent){
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = email;
        res.render("change-password-otp")
        console.log("OTP: ",otp);
        
      }else{
        res.json({
          success : false,
          meassage : "Failed to send OTP. Please try again"
        })
      }

    }else{
      res.render("change-password",{
        message : "User with this email does not exist"
      })
    }
    
  } catch (error) {
    console.log("Error in change password validation",error);
    res.redirect("/pageNotFound")
  }
}

const verifyChangePassOtp = async (req, res) => {
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




module.exports ={
    getForgotPasswordPage,
    forgotEmailValid,
    verifyForgotpassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    changeEmail,
    changeEmailValidation,
    verifyEmailOtp,
    updateEmail,
    changePassword,
    changePasswordValid,
    verifyChangePassOtp

}