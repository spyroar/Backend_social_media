import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();

const generateAccessandrefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validatebeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generate Access and Refresh token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation - not empty
  // check if user already exists: username, email
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return res

  const { fullName, email, username, password } = req.body;
  //console.log("email: ", email);

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }
  console.log(req.body);
  console.log(req.files);
  const avatarLocalPath = req.files.avatar ? req.files.avatar[0].path : null;
  // const avatarLocalPath = req.files?.avatar[0]?.path;
  //const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Avatar is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //req body -data
  // take username or email
  //find user or not
  // check rigth password
  // access and refresh token
  // send cookies

  const { email, username, password } = req.body;

  if (!(email || username)) {
    throw new ApiError(400, "Email or username is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not Exists");
  }
  const isPasswordvalid = await user.isPasswordCorrect(password);

  if (!isPasswordvalid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessandrefreshTokens(
    user._id
  );
  const loggedInuser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInuser,
          refreshToken,
          accessToken,
        },
        "User LoggedIn SuccessFully "
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    { new: true }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incommingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incommingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }
  try {
    const decodedToken = jwt.verify(
      incommingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }
    if (incommingRefreshToken != user?.refreshToken) {
      throw new ApiError(401, "refreshToken Expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, newRefreshToken } =
      await generateAccessandrefreshTokens(user._id);
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access Token Refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldpassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldpassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid Old password");
  }
  user.password = newPassword;
  await user.save({ validatebeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Change Successfully"));
});

const getCurrentUser = asyncHandler(async (req,res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current data fetched"));
});

const updateAcountDetails = asyncHandler(async (req, res) => {
  const { email, fullName } = req.body;
  if (!(email || fullName)) {
    throw new ApiError(400, "All field are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { fullName, email },
    },
    { new: true }
  ).select("-password");
  return res.status(200)
  .json(
     new ApiResponse(200,user,"Account Details updated")
  )
});

const updateUserAvatar=asyncHandler(async(req,res)=>{
       const avatarLocalpath= req.file?.path;
       if (!avatarLocalpath) {
         throw new ApiError(400,"Avatar file is missing")
       }

      const avatar=  await uploadOnCloudinary(avatarLocalpath)
       if (!avatar.url) {
        throw new ApiError(400,"error while uploading Avatar");
       }
   const user=  await  User.findByIdAndUpdate(req.user?._id,
        {$set:{
          avatar:avatar.url
        }},
        {new:true}
       ).select("-password")

       return res
       .status(200)
       .json(new ApiResponse(
        200,user,"Avatar updated Successfully"
       ))
})  

const updateUserCoverImage=asyncHandler(async(req,res)=>{
  const coverImageLocalpath= req.file?.path;
  if (!coverImageLocalpath) {
    throw new ApiError(400,"Cover Image file is missing")
  }

 const coverImage=  await uploadOnCloudinary(coverImageLocalpath)
  if (!coverImage.url) {
   throw new ApiError(400,"error while uploading cover image");
  }
const user=  await  User.findByIdAndUpdate(req.user?._id,
   {$set:{
     coverImage:coverImage.url
   }},
   {new:true}
  ).select("-password")

  return res
  .status(200)
  .json(new ApiResponse(
   200,user,"Cover Image updated Successfully"
  ))
})  

const getUserChannelprofile=asyncHandler(async()=>{
      const {username}=req.pamas
      if (!username) {
        throw new ApiError(400,"username is missing")

      }

      const channel=await User.aggregate([
           {
            $match:{
              username:username?.toLowerCase()
   
            }
           },
           {
            $lookup:{
               from:"subscriptions",
               localField:"_id",
               foreignField:"channel",
               as:"subscribers"
               
            }
             
           },
           {
            $lookup:{
               from:"subscriptions",
               localField:"_id",
               foreignField:"subscriber",
               as:"subscribedTo"
               
            }
             
           },
           {
            $addFields:{
              
          subscribersCount:{ $size:"$subscribers"},
         channelsSubscribredToCount:{$size:"$subscribedTo"},
         isSubscribed:{
           $cond:{
              if:{$in:[req.user?._id,"$subscribers.subscriber"]},
              then:true,
              else:false
           }
         }
            }
           },
           {
            $project:{
               username:1,
               email:1,
               fullName:1,
               subscribersCount:1,
               channelsSubscribredToCount:1,
               avatar:1,
               coverImage:1,
              isSubscribed:1

            }
           }
           
      ])

      if (!channel) {
        throw new ApiError(400,"channel does not exists")
      }

      return res
      .status(200)
      .json(
        new ApiResponse(200,channel[0],"user channel feched successfully")
      )
})

const getWatchHistory=asyncHandler(async (req,res)=>{
       
   const user=await User.aggregate([
       {
        $match :{
          _id: new mongoose.Types.ObjectId(req.user?._id)
        }
       },
       {
        $lookup:{
           form:"videos",
           localField:"watchHistory",
           foreignField:"_id",
           as:"watchHistory",
           pipeline:[
            {
              from:"users",
              localField:"owner",
              foreignField:"_id",
              as:"owner",
              pipeline:[
                {
                    $project:{
                       fullName:1,
                       username:1,
                       avatar:1
                    }
                }
              ]
            
            },
            {
              $addFields:{
                owner:{
                  $first:"$owner"
                }
              }
            }
           ]
        }
       },

   ]) ;

   return res
   .status(200)
   .json(
    new ApiResponse(200,user[0].watchHistory,"Watch History fetched")
   )

})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAcountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelprofile,
  getWatchHistory
};
