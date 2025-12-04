import { Router } from "express";
import { registerBus } from "../controller/bus.controller";

const router = Router()

router.route("/registerBus").post(registerBus)

export default router