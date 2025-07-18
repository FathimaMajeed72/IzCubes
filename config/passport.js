const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const env = require("dotenv").config();

const isProd = process.env.NODE_ENV === "production";

passport.use(new GoogleStrategy({
    clientID : process.env.GOOGLE_CLIENT_ID,
    clientSecret : process.env.GOOGLE_CLIENT_SECRET,
    callbackURL : isProd
        ? "https://izcubes.shop/auth/google/callback"     
        : "http://localhost:3000/auth/google/callback"
},

async (accessToken,refreshToken,profile,done)=>{
    try {
         const email = profile.emails[0].value;
         const profileImage = profile.photos?.[0]?.value || "/img/defaultProfileImage.jpg";
         console.log("Google Profile:", profileImage);

   
        let existingUser = await User.findOne({email});
        if(existingUser){
            if (existingUser.isBlocked) {
                return done(null, false, { message: 'Your Account is blocked' });
            }

            if (!existingUser.googleId) {
                return done(null, false, { message: "An account with this email already exists. Please log in using your password." });
            }

            return done(null,existingUser);
        }else{

            const newUser = new User({
                name : profile.displayName,
                email : profile.emails[0].value,
                googleId : profile.id,
                profileImage: profileImage
            })
            await newUser.save();
            return done(null,newUser);
        }
    } catch (error) {
        console.error("GoogleStrategy Error:", error);
        return done(error,null)
    }
    
}

))


passport.serializeUser((user,done)=>{
    done(null,user.id)
})

passport.deserializeUser((id,done)=>{
    User.findById(id)
    .then(user=>{
        done(null,user)
    })
    .catch(error=>{
        done(error,null)
    })
})



module.exports = passport;