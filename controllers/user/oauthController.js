const passport = require("passport");





const googleCallback = (req, res, next) => {
    passport.authenticate("google", (err, user, info) => {
        if (err) {
            console.error("Google Auth Error:", err);
            return res.redirect("/login?message=Something went wrong during Google login.");
        }

        if (!user) {
            const message = info?.message || "Google login failed.";
            return res.redirect(`/login?message=${encodeURIComponent(message)}`);
        }

        req.logIn(user, (err) => {
            if (err) {
                console.error("Login error:", err);
                return res.redirect("/login?message=Failed to log in.");
            }
            return res.redirect("/");
        });
    })(req, res, next);
};


module.exports = {
    
    googleCallback
}