import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/Cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async(userId)=>{
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave:false})
        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async(req,res)=>{
    // validating - not empty
    const {username,email,fullName,password} = req.body;
    if(
        [username,email,fullName,password].some((field) => field?.trim==="")
    ){
        throw new ApiError(400,"All fields are required")
    } 
    //already exists or not
    const existedUser = await User.findOne({
        $or:[{ username }, { email }]
    })
    if(existedUser){
        throw new ApiError(409,"User with email or username already exists");
    }
    // uploading avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required");
    }
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath = req.files.coverImage[0].path
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400,"Avatar is required");
    }
    const user = await User.create({
        username:username.toLowerCase(),
        email,
        fullName,
        password,
        avatar:avatar.url,
        coverImage:coverImage?.url||"",
    })
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
        )
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }
    return res.json(201).json(new ApiResponse(201,createdUser,"User registered Successfully"))
})

const loginUser = asyncHandler(async(req,res)=>{
    const {username,email,password} = req.body;
    if(!username && !email){
        throw new ApiError(400,"username or email is required")
    }
    const user = await User.findOne({
        $or:[{username},{email}]
    })
    if(!user){
        throw new ApiError(404,"user does not exist")
    }
    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }
    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id)
    const loggedInUser = await User.findById(user._id).select("-password =refreshToken")

    const options = {
        httpOnly:true,
        secure:true
    }

    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,
                accessToken,
                refreshToken
            },
            "User logged in successfully "
        )
    )
})

const logOutUser = asyncHandler(async (req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    );
    const options = {
        httpOnly:true,
        secure:true
    }
    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(200,{},"User logged Out")
    )
})

const refreshAccessToken = asyncHandler(async()=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized request")
    }
    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id);
        if(!user){
            throw new ApiError(401,"Invalid refresh token")
        }
        if(incomingRefreshToken !==user.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used")
        }
        const options = {
            httpOnly:true,
            secure:true
        }
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res.status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(new ApiResponse(200,{accessToken,refreshToken:newRefreshToken},"Access token refreshed"))
    } catch (error) {
        throw new ApiError(401,error?.message||"Invalid refresh token")
    }
})
export {registerUser, loginUser,logOutUser,refreshAccessToken}