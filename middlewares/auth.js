const User = require("../models/userSchema")


const userAuth = async (req, res, next) => {
    try {
        
        const user = req.session.user || req.user;

        if (!user || !user._id) {
            
            return res.render("login",{message:"Please login to continue"})
        }

        const foundUser = await User.findById(user._id);

        if (!foundUser) {

            return res.render("login",{message:"User not found"})
        }

        if (foundUser.isBlocked) {
            req.session.destroy(() => {
                
                return res.render("login",{message:"User is blocked by admin"})
            });
        } else {
            req.user = foundUser;
            next();
        }
    } catch (error) {
        console.error("Error in user auth middleware", error);
        res.status(500).send("Internal Server Error");
    }
};




const adminAuth = async(req,res,next)=>{
    try {
    const adminSession = req.session.admin;

    if (!adminSession || !adminSession._id) {
      return res.redirect("/admin/login");
    }

    const admin = await User.findById(adminSession._id);

    if (!admin || !admin.isAdmin) {
      return res.redirect("/admin/login");
    }

    req.user = admin;
    next();
  } catch (err) {
    console.error("Error in admin auth middleware", err);
    res.status(500).send("Internal Server Error");
  }
}



module.exports = {
    userAuth,
    adminAuth
}