import { Router } from "express";
import { createBusTrip, getBusDetailsById, getHomePageBusDetails, getSearchResultOfBus, registerBus } from "../controller/bus.controller";

const router = Router()

router.route("/registerBus").post(registerBus)
router.route("/getHomePageBusDetails").get(getHomePageBusDetails)
router.route("/createBusTrip").post(createBusTrip)
router.route("/getSearchResult").get(getSearchResultOfBus)
router.route("/getBusDetails/:busId").get(getBusDetailsById)

export default router