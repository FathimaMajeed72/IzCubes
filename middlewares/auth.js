const User = require("../models/userSchema")


const userAuth = async (req, res, next) => {
    try {
        
        const user = req.session.user || req.user;

        if (!user || !user._id) {
            //return res.redirect("/login?message=Please%20login%20to%20continue");
            return res.render("login",{message:"Please login to continue"})
        }

        const foundUser = await User.findById(user._id);

        if (!foundUser) {
            //return res.redirect("/login?message=User%20not%20found");
            return res.render("login",{message:"User not found"})
        }

        if (foundUser.isBlocked) {
            req.session.destroy(() => {
                //return res.redirect("/login?message=User%20is%20blocked%20by%20admin");
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




const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
            next();
        }else{
            res.redirect("/admin/login")
        }
    })
    .catch(error=>{
        console.log("Error in admin auth middleware",error);
        res.status(500).send("Internal Server Error")
    })
}



module.exports = {
    userAuth,
    adminAuth
}