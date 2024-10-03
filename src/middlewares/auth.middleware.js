import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import dotenv  from "dotenv";
dotenv.config();

const verifyJWT = asyncHandler(async (req, res, next) => {
 try {
      
     const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
     if (!token) {
       throw new ApiError(401, "Unuathorized request");
     }
     const decodeToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
       const user= User.findOne(decodeToken?._id).select("-password -refreshToken")
   
       if (!user) {
           throw new ApiError(401, "Invalid Access Token");
       }
       req.user=user
       next();
 } catch (error) {
    throw new ApiError(401,error?.message ||"Invalid Access Token");
 }
});
export {verifyJWT}