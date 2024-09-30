import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
    //  get user details from frontend or postman
    // validation - not empaty
    // check if user already exists:username or email
    // check for images,check for avatar
    // upload them to cloudinary, avatar check
    // create user object- create entry in db
    // remove password and access token field from response
    // check for user creation
    // return res

      const {username,fullName,password,email}=req.body
        //  console.log(email);
         
         if ([username,fullName,password,email].some((field)=>
            field?.trim()==="")
        ) {
            throw new ApiError(400,"All Field are required")
         }
      const existUser=  User.findOne({
         $or: [{ username },{ email }]
        }) 
        if (existUser) {
      throw new ApiError(409,"User with email and username already exists");
            
        }
        const avatarLocalpath=req.files?.avatar[0]?.path;
        const  coverImageLocalpath=req.files?.coverImage[0]?.path;
        if(!avatarLocalpath)
        {
          throw new ApiError(400,"Avatar file is required")
        }
      const avatar=await  uploadOnCloudinary(avatarLocalpath)
      const coverImage=await uploadOnCloudinary(coverImageLocalpath)

      if (!avatar) {
        throw new ApiError(400,"Avatar file is required")
      }

     const user=await User.create({
          fullName,
          avatar:avatar.url,
          coverImage:coverImage?.url ||"",
          email,
          password,
          username:username.toLowercase()

      })

    const createUser=   User.findById(user._id).select(
         "-password -refreshToken"
       )
       if (!createUser) {
        throw new ApiError(500,"Something went wrong while registering user")
       }
        
       return res.status(201).json(
         new ApiResponse(
          200,
          createUser,"User Register Successfully"
         )
       );
});

export {registerUser}