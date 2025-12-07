import { Router } from "express";
import { createBusTrip, getHomePageBusDetails, registerBus } from "../controller/bus.controller";

const router = Router()

router.route("/registerBus").post(registerBus)
router.route("/getHomePageBusDetails").get(getHomePageBusDetails)
router.route("/createBusTrip").post(createBusTrip)

export default router