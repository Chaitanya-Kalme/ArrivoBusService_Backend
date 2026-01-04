import type { Request,Response,NextFunction } from "express"
import jwt, { type JwtPayload } from "jsonwebtoken"
import prisma from "../lib/prisma"

export default async function verifyDriverJWT (req:Request,res: Response,next:NextFunction){
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")

        if(!token){
            throw new Error("Unauthorized Request")
        }

        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET!) as JwtPayload
        
        const driver = await prisma.driver.findFirst({
            where:{
                id: decodedToken?.id
            },
            include:{
                trips: {
                    include:{
                        busDetails: {
                            include:{
                                stops: true
                            }
                        }
                    }
                }
            }
        })
        
        if(!driver){
            throw new Error("User is not logged in")
        }
        (req as any).driver= driver 
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