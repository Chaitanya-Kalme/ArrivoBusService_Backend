import type { Request,Response,NextFunction } from "express"
import jwt, { type JwtPayload } from "jsonwebtoken"
import prisma from "../lib/prisma"

export default async function verifyJWT (req:Request,res: Response,next:NextFunction){
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")

        if(!token){
            throw new Error("Unauthorized Request")
        }

        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET!) as JwtPayload
        const user = await prisma.user.findFirst({
            where:{
                id: decodedToken?.id
            },
            include:{
                bookings: true
            }
        })
        
        if(!user){
            throw new Error("User is not logged in")
        }
        (req as any).user = user
        next()

    } catch (error:any) {
        console.log(error)
        return res.status(500)
        .json({
            success: false,
            message: error.message || "Invalid Access Token"
        })
        
    }
}