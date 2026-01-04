import { Router } from "express"
import { getLoggedInDriver, LoginDriver, LogoutDriver, refreshAccessToken, registerDriver } from "../controller/driver.controller"
import verifyDriverJWT from "../middleware/driver.middleware"

const router = Router()


router.route("/registerDriver").post(registerDriver)
router.route("/loginDriver").post(LoginDriver)
router.route("/updateAccessToken").post(refreshAccessToken)
router.route("/logout/:driverId").post(LogoutDriver)
router.route("/getLoggedInDriver").get(verifyDriverJWT, getLoggedInDriver)


export default router