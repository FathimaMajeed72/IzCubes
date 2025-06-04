const express = require("express")
const router = express.Router();
const userController = require("../controllers/user/userController")
const passport = require("passport");
const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productController")
const wishlistController = require("../controllers/user/wishListController")
const cartController = require("../controllers/user/cartController");
const {userAuth,adminAuth} = require("../middlewares/auth")
const multer = require("multer")
const storage = require("../helpers/multer")
const uploads = multer({storage:storage});



router.get("/pageNotFound",userController.pageNotFound)

router.get("/",userController.loadHomepage);

router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup)
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp", userController.resendOtp)
router.get("/auth/google",passport.authenticate('google',{scope : ['profile','email']}))
router.get("/auth/google/callback",passport.authenticate('google',{failureRedirect:'/login?message=User%20is%20blocked'}),(req,res)=>{
    res.redirect("/")
})

router.get("/login",userController.loadLogin)
router.post("/login",userController.login)

router.get("/logout",userController.logout);


router.get("/forgot-password",profileController.getForgotPasswordPage)
router.post("/forgot-email-valid",profileController.forgotEmailValid)
router.post('/verify-passForgot-otp',profileController.verifyForgotpassOtp);
router.get('/reset-password',profileController.getResetPassPage)
router.post("/resend-forgot-otp",profileController.resendOtp)
router.post("/reset-password",profileController.postNewPassword);
router.get("/userProfile",userAuth,profileController.userProfile);
router.post("/editProfile",userAuth,uploads.single('profileImage'),profileController.editProfile);
router.get("/change-email",userAuth,profileController.changeEmail);
router.post("/change-email",userAuth,profileController.changeEmailValidation);
router.post("/verify-email-otp",userAuth,profileController.verifyEmailOtp)
router.post("/update-email",userAuth,profileController.updateEmail)
router.get("/change-password",userAuth,profileController.changePassword);
router.post("/change-password",userAuth,profileController.changePasswordValid);
router.post("/verify-changepassword-otp",userAuth,profileController.verifyChangePassOtp)


router.get("/addAddress",userAuth,profileController.addAddress);
router.post("/addAddress",userAuth,profileController.postAddAddress)
router.post("/editAddress",userAuth,profileController.postEditAddress);
router.get("/deteAddress",userAuth,profileController.deleteAddress);



router.get("/shop",userAuth,userController.loadShoppingPage)



router.get("/productDetails",userAuth,productController.productDetails);


router.get("/wishlist",userAuth,wishlistController.loadWishlist);
router.post("/addToWishlist",userAuth,wishlistController.addToWishlist);
router.get("/removeFromWishlist",userAuth,wishlistController.removeProduct);



router.get("/cart", userAuth, cartController.getCartPage)
router.post("/addToCart",userAuth, cartController.addToCart)
router.post("/changeQuantity", userAuth,cartController.changeQuantity)
router.get("/deleteItem", userAuth, cartController.deleteProduct)


module.exports = router;