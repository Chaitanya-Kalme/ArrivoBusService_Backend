import type { Request, Response } from "express";
import prisma from "../lib/prisma";
import jwt, { type JwtPayload } from "jsonwebtoken"
import bcrypt from "bcryptjs"

export async function registerDriver(req: Request, res: Response) {
    try {
        // Collect the data of driver.
        const { userName, email, password, mobileNo } = req.body

        if (!userName || !email || !password || !mobileNo) {
            return res.status(404)
                .json({
                    success: false,
                    message: "All fields are required"
                })
        }

        // Check that the driver exist with this email id or not.
        const isDriverExist = await prisma.driver.findFirst({
            where: {
                email: email
            }
        })

        if (isDriverExist) {
            return res.status(400)
                .json({
                    success: false,
                    message: "Driver already exist with this email id"
                })
        }

        // hash the password and store data in database.
        const hashedPassword = await bcrypt.hash(password, 10);

        const driver = await prisma.driver.create({
            data: {
                userName,
                email,
                password: hashedPassword,
                mobileNo
            }
        })


        return res.status(200)
            .json({
                success: true,
                message: "Driver registered successfully",
                driverDetails: driver
            })


    } catch (error: any) {
        console.log(error)
        return res.status(500)
            .json({
                success: false,
                message: error.message || "Server error while registering driver"
            })

    }
}


export async function LoginDriver(req: Request, res: Response) {
    try {
        // Check details from frontend.
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(404)
                .json({
                    success: false,
                    message: "Email and password is required"
                })
        }

        // Now check that driver exist or not.
        const isDriverExist = await prisma.driver.findFirst({
            where: {
                email: email
            }
        })

        if (!isDriverExist) {
            return res.status(400)
                .json({
                    success: false,
                    message: "Driver does not exist with this email id"
                })
        }

        // Check that password is correct or not.
        const isPasswordCorrect = await bcrypt.compare(password, isDriverExist.password)

        if (!isPasswordCorrect) {
            return res.status(400)
                .json({
                    success: false,
                    message: "Password is incorrect"
                })
        }

        // Now assign the token to driver.
        const accessToken = await jwt.sign({
            id: isDriverExist.id,
            userName: isDriverExist.userName,
            email: isDriverExist.email,
            role: "DRIVER",
        },
            process.env.ACCESS_TOKEN_SECRET!,
            {
                expiresIn: parseInt(process.env.ACCESS_TOKEN_EXPIRES!)
            }
        )

        const refreshToken = await jwt.sign({
            id: isDriverExist.id,
            userName: isDriverExist.userName,
            email: isDriverExist.email,
            role: "DRIVER"
        },
            process.env.REFRESH_TOKEN_SECRET!,
            {
                expiresIn: parseInt(process.env.REFRESH_TOKEN_EXPIRES!)
            }
        )

        const updatedDriver = await prisma.driver.update({
            where: {
                id: isDriverExist.id
            },
            data: {
                refreshToken: refreshToken
            }
        })

        return res.status(200)
            .cookie("accessToken", accessToken, {
                httpOnly: true,
                secure: true
            })
            .cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: true,
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            })
            .json({
                success: true,
                message: "Driver logged in sucessfully"
            })

    } catch (error: any) {
        console.log(error)
        return res.status(500)
            .json({
                success: false,
                message: error.message || "Server error while logging driver"
            })
    }
}

export async function refreshAccessToken(req: Request, res: Response) {
    try {
        // Check the refresh token from cookies. 
        const refreshToken = req.cookies?.refreshToken


        if (!refreshToken) {
            return res.status(400)
                .json({
                    success: false,
                    message: "Invalid Refresh Token"
                })
        }

        // Check that the driver exist with this refresh token. 
        const decodedToken = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as JwtPayload

        if(!decodedToken?.role){
            return res.status(400)
            .json({
                success: false,
                message: "Invalid refresh token"
            })
        }   

        const driver = await prisma.driver.findFirst({
            where:{
                id: decodedToken.id
            }
        })

        if(!driver){
            return res.status(400)
            .json({
                success: false,
                message: "Driver does not exist with this "
            })
        }

        // Now check that refresh token in database and refresh token get are same.
        if(refreshToken !==driver.refreshToken){
            return res.status(400)
            .json({
                success: false,
                message: "Refresh Token expired."
            })
        }

        // Now assign the token to driver.
        const accessToken = await jwt.sign({
            id: driver.id,
            userName: driver.userName,
            email: driver.email,
            role: "DRIVER",
        },
            process.env.ACCESS_TOKEN_SECRET!,
            {
                expiresIn: parseInt(process.env.ACCESS_TOKEN_EXPIRES!)
            }
        )

        const updatedRefreshToken = await jwt.sign({
            id: driver.id,
            userName: driver.userName,
            email: driver.email,
            role: "DRIVER"
        },
            process.env.REFRESH_TOKEN_SECRET!,
            {
                expiresIn: parseInt(process.env.REFRESH_TOKEN_EXPIRES!)
            }
        )

        const updatedDriver = await prisma.driver.update({
            where: {
                id: driver.id
            },
            data: {
                refreshToken: updatedRefreshToken
            }
        })

        return res.status(200)
            .cookie("accessToken", accessToken, {
                httpOnly: true,
                secure: true
            })
            .cookie("refreshToken", updatedRefreshToken, {
                httpOnly: true,
                secure: true,
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            })
            .json({
                success: true,
                message: "Driver logged in sucessfully"
            })

        

    } catch (error: any) {
        console.log(error)
        return res.status(500)
            .json({
                success: false,
                message: error.message || "Server error while refreshing access token"
            })

    }
}


export async function LogoutDriver(req: Request, res:Response){
    try {
        // Check driver id from params.
        const driverId = req.params.driverId

        if(!driverId){
            return res.status(404)
            .json({
                success: false,
                message: "Driver Id is required"
            })
        }

        // Check that driver exist or not .
        const driver = await prisma.driver.update({
            where:{
                id: driverId
            },
            data:{
                refreshToken: null
            }
        })

        if(!driver){
            return res.status(400)
            .json({
                success: false,
                message: "Driver does not exist with this id."
            })
        }

        // Remove tokens from cookies. 
        const options = {
            httpOnly: true,
            secure: true
        }

        // Remove the tokens from cookies.
        res.clearCookie("accessToken",options)
        res.clearCookie("refreshToken",options)

        return res.status(200)
        .json({
            success: true,
            message: "Driver logged out successfully"
        })
        
    } catch (error:any) {
        console.log(error)
        return res.status(500)
        .json({
            success: false,
            message: error.message || "Server error while Logout of driver."
        })
        
    }
}

export async function getLoggedInDriver(req: Request, res: Response){
    try {
        const driver = req.driver

        if(!driver){
            return res.status(400)
            .json({
                success: false,
                message: "Driver is not logged in. "
            })
        }

        return res.status(200)
        .json({
            success: false,
            message: "Logged in driver fetched successfully",
            driverDetails: driver
        })
        
    } catch (error:any) {
        console.log(error)
        return res.status(500)
        .json({
            success: false,
            message: error.message || "Server Error while fetching driver"
        })
        
    }
}