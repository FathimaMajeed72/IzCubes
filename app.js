const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv").config();
const session = require("express-session");
const passport = require("./config/passport");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter")
db();


app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(session({
    secret : process.env.SESSION_SECRET,
    resave : false,
    saveUninitialized : false,
    cookie : {
        secure : false,
        httpOnly : true,
        maxAge : 72*60*60*1000
    }
}))


app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  if (req.user && !req.session.user) {
    req.session.user = req.user;
  }
  next();
});



app.use((req, res, next) => {
    res.locals.user = req.session.user||null; 
    next();
});


app.use((req,res,next)=>{
    res.set('cache-control','no-store');
    next();
})



app.set("view engine","ejs");
app.set("views",[path.join(__dirname,"views/user"),path.join(__dirname,"views/admin")]);
app.use(express.static(path.join(__dirname,"public")));


app.use("/",userRouter);
app.use("/admin",adminRouter);




app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/admin")) {
    return res.status(404).render("admin-error", { message: "Page not found" });
  }
  res.status(404).render("page-404", { message: "Page not found" });
});

app.use((err, req, res, next) => {
  console.error("Internal Server Error:", err.stack);

  if (req.originalUrl.startsWith("/api") || req.xhr || req.headers.accept?.includes("json")) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }

  if (req.originalUrl.startsWith("/admin")) {
    return res.status(500).render("admin-error", {
      message: "Something went wrong on the admin panel."
    });
  }

  res.status(500).render("page-500", {
    message: "Something went wrong on the user side."
  });
});



app.listen(process.env.PORT||3000,()=>{
    console.log("Server Started");
    
});

module.exports = app;