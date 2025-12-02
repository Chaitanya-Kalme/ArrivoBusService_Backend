import express,{json} from "express";
import userRouter from "./routes/user.routes.js";
import cookieParser from "cookie-parser";
const app = express()

app.use(json()); 
app.use(cookieParser());

app.use("/api/v1/user",userRouter)

export default app

