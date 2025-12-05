import express,{json} from "express";
import cookieParser from "cookie-parser";
const app = express()

app.use(json()); 
app.use(cookieParser());


// All Router are imported here
import userRouter from "./routes/user.routes.js";
import busRouter from "./routes/bus.routes.js"
import bookingRouter from "./routes/booking.routes.js"

// All router are used here
app.use("/api/v1/user",userRouter)
app.use("/api/v1/bus", busRouter)
app.use("/api/v1/booking",bookingRouter)

export default app

