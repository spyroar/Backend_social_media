import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

const verifyJWT = asyncHandler(async (req, res, next) => {
 try {
     const token =
       req.cookie?.accessToken ||
       req.header("Authorizaton")?.replace("Bearer ", "");
     if (!token) {
       throw new ApiError(401, "Unuathorized request");
     }
     const decodeToekn = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
       const user= User.findOne(decodeToekn?._id).select("-password","-refreshToken")
   
       if (!user) {
           throw new ApiError(401, "Invalid Access Token");
       }
       req.user=usern
       next();
 } catch (error) {
    throw new ApiError(401,error?.message ||"Invalid Access Token");
 }
});
export {verifyJWT}