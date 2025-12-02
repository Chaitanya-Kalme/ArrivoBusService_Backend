import { Router } from "express";
import { getUserProfile, loginUser, registerUser, sendVerificationEmail, verifyUser } from "../controller/user.controller.ts";


const router = Router()

router.route("/registerUser").post(registerUser)
router.route("/sendVerificationEmail").post(sendVerificationEmail)
router.route("/getUserProfile").get(getUserProfile)
router.route("/loginUser").post(loginUser)
router.route("/verifyUser/:userId").post(verifyUser)


export default router