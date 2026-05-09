import passport from "passport";
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';


passport.use(new GoogleStrategy({
    clientID:  process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback',
},async (accessToken,refreshToken, profile, done)=>{
    try {
        let user = await User.findOne({ googleId: profile.id });
        if(!user){
            user = await User.create({
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value,
                avatar: profile.photos[0].value,
                isVerified: true,
            });
        }
        done(null,user);
    } catch (err) {
        done(err,null);}
}));

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: '/api/auth/github/callback',
    scope: ['user:email'],
},async(accessToken,refreshToken,profile,done)=>{
     try {
        let user = await User.findOne({githubId:profile.id});
        if(!user){
            user = await User.create({
                githubId:profile.id,
                name: profile.displayName || profile.username,
                email: profile.emails?.[0]?.value ||`${profile.username}@github.com`,
                avatar: profile.photos?.[0]?.value,
                isVerified: true,
            });
        }
        done(null,user);
     } catch (err) {
        done(err,null);
     }
}));


export default passport;
/*this files consist the logic of Qauth,github*/