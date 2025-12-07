import { Router } from "express";
import { cancelBooking, registerBooking, sendEmailforBooking, sendEmailForCancellation } from "../controller/booking.controller";
import verifyJWT from "../middleware/auth.middleware";

const router = Router()

router.route("/bookTicket").post(verifyJWT, registerBooking)
router.route("/cancelBooking/:bookingId").delete(verifyJWT, cancelBooking,sendEmailForCancellation)
router.route("/sendBookingEmail/:bookingId").post(sendEmailforBooking)


export default router