import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
const userSchema = new mongoose.Schema({
    username:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
        index:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
    },
    fullname:{
        type:String,
        required:true,
        trim:true,
        index:true
    },
    avatar:{
        type:String, //cloudnary service
        required:true,
    },
    coverImage:{
        type:String
    },
    watchHistory:[
        {
            type: mongoose.Schema.Types.ObjectId,
            ref:"Video"
        }
    ],
    fullname:{
        type:String,
        required:[true,"Password is required"]
    },
    refreshToken:{
        type: String
    }
},{timestamps:true})
userSchema.pre("save",async function(next){
    if(!this.isModified("password")) return next();
    
    this.password = bcrypt.hash(this.password,10)
    next();
})
export const User = mongoose.model("User",userSchema)