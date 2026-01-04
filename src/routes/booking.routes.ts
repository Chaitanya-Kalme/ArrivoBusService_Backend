import { Router } from "express";
import { cancelBooking, createBookingAndOrder, fetchUserBookings, registerBooking, sendEmailforBooking, sendEmailForCancellation } from "../controller/booking.controller";
import verifyJWT from "../middleware/auth.middleware";

const router = Router()

// router.route("/bookTicket").post(verifyJWT, registerBooking)
router.route("/createBooking").post(verifyJWT,createBookingAndOrder)
router.route("/cancelBooking/:bookingId").delete(verifyJWT, cancelBooking,sendEmailForCancellation)
router.route("/sendBookingEmail/:bookingId").post(sendEmailforBooking)
router.route("/fetchUserBookings/:userId").get(fetchUserBookings)


export default router