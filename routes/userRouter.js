const express = require("express")
const router = express.Router();
const userController = require("../controllers/user/userController")
const passport = require("passport");
const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productController")
const wishlistController = require("../controllers/user/wishListController")
const cartController = require("../controllers/user/cartController");
const orderController = require("../controllers/user/orderController")
const checkoutController = require("../controllers/user/checkoutController")
const invoiceController = require("../controllers/user/invoiceController")
const paymentController = require("../controllers/user/paymentController")
const couponController = require("../controllers/user/couponController")
const oauthController = require("../controllers/user/oauthController");

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
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback", oauthController.googleCallback);



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
router.post("/resend-email-otp",userAuth,profileController.resendOtp)
router.get("/change-password",userAuth,profileController.getChangePassword);
router.post("/change-password",userAuth,profileController.postChangePassword);


router.get("/addAddress",userAuth,profileController.addAddress);
router.post("/addAddress",userAuth,profileController.postAddAddress)
router.post("/editAddress",userAuth,profileController.postEditAddress);
router.delete("/deleteAddress/:id",userAuth,profileController.deleteAddress);



router.get("/shop",userAuth,userController.loadShoppingPage)



router.get("/productDetails",userAuth,productController.productDetails);


router.get("/wishlist",userAuth,wishlistController.loadWishlist);
router.post("/addToWishlist",userAuth,wishlistController.addToWishlist);
router.get("/removeFromWishlist",userAuth,wishlistController.removeProduct);



router.get("/cart", userAuth, cartController.getCartPage)
router.post("/addToCart",userAuth, cartController.addToCart)
router.post("/changeQuantity", userAuth,cartController.changeQuantity)
router.get("/deleteItem", userAuth, cartController.deleteProduct)



router.get("/checkout", userAuth, checkoutController.checkout)
router.post("/validate-quantity", userAuth, checkoutController.validateCartQuantity);


router.post("/orders",userAuth, orderController.placeOrder);
router.get("/order-success",userAuth,orderController.orderSuccess)
router.get("/orders/:orderId",userAuth,orderController.getOrderDetail);
router.post("/cancel-order",userAuth, orderController.cancelEntireOrder);
router.post("/cancel-item",userAuth, orderController.cancelOrderItem);
router.post("/return-order",userAuth, orderController.returnEntireOrder);
router.post("/return-item",userAuth, orderController.returnOrderItem);
router.get('/orders/search',userAuth, orderController.searchUserOrders);
router.get("/order-failure",userAuth, orderController.orderFailure);




router.post("/create-razorpay-order",userAuth,paymentController.createRazorpayOrder);
router.post("/razorpay-payment-failed", userAuth, paymentController.saveFailedOrder);




router.post('/apply-coupon',userAuth, couponController.applyCoupon);
router.post('/remove-coupon',userAuth, couponController.removeCoupon);




router.get('/invoice/:orderId',userAuth, invoiceController.generateInvoice);


module.exports = router;