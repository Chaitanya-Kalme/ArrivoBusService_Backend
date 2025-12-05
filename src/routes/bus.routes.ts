import { Router } from "express";
import { getHomePageBusDetails, registerBus } from "../controller/bus.controller";

const router = Router()

router.route("/registerBus").post(registerBus)
router.route("/getHomePageBusDetails").get(getHomePageBusDetails)

export default router