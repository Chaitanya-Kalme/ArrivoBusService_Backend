import { Router } from "express";
import { getLoggedInUser, getUserProfile, loginUser, LogoutUser, registerUser, sendVerificationEmail, updateAccessToken, updatePassword, verifyUser } from "../controller/user.controller.ts";
import verifyJWT from "../middleware/auth.middleware.js";


const router = Router()

router.route("/registerUser").post(registerUser)
router.route("/sendVerificationEmail").post(sendVerificationEmail)
router.route("/getUserProfile").get(getUserProfile)
router.route("/loginUser").post(loginUser)
router.route("/verifyUser/:userId").post(verifyUser)
router.route("/changePassword/:userId").patch(verifyJWT,updatePassword)
router.route("/refreshAccessToken").patch(updateAccessToken)
router.route("/logout").post(verifyJWT,LogoutUser)
router.route("/getLoggedInUser").get(verifyJWT,getLoggedInUser)

export default router