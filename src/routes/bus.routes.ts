import { Router } from "express";
import { createBusTrip, getBusDetailsById, getHomePageBusDetails, getSearchResultOfBus, registerBus } from "../controller/bus.controller";
import verifyDriverJWT from "../middleware/driver.middleware";
import { updateBusIssue } from "../controller/booking.controller";

const router = Router()

router.route("/registerBus").post(registerBus)
router.route("/getHomePageBusDetails").get(getHomePageBusDetails)
router.route("/createBusTrip").post(createBusTrip)
router.route("/getSearchResult").get(getSearchResultOfBus)
router.route("/getBusDetails/:busId").get(getBusDetailsById)
router.route("/updateBusIssue/:busId").post(verifyDriverJWT,updateBusIssue)

export default router