import prisma from "../lib/prisma"
import bcrypt from "bcryptjs"
import { type Request, type Response } from "express"
import { sendEmail } from "../lib/sendEmail"
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import jwt, { type JwtPayload } from "jsonwebtoken"


export async function registerUser(req: Request, res: Response) {
    try {
        // Getting the data from frontend.
        const { userName, email, password, mobileNo } = req.body

        // Check that all the required fields are present or not. 
        if (!userName || !email || !password || !mobileNo) {
            return res.status(404)
                .json({
                    success: false,
                    message: "All the fields are required"
                })
        }

        // Check that if user already exist with the given email
        const isUserExist = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email },
                    { mobileNo: mobileNo }
                ]
            }
        })

        if (isUserExist) {
            return res.status(400)
                .json({
                    success: false,
                    message: "User already exist"
                })
        }

        // Check avatar image.
        // const imageName = `${userName[0].toUpperCase()}.jpg`
        // const avatarImage = req?.file?.filename || imageName 

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create User
        const user = await prisma.user.create({
            data: {
                userName,
                email,
                mobileNo,
                password: hashedPassword,
            }
        })


        return res.status(200)
            .json({
                success: true,
                message: "User Created successfully",
                userData: user
            })

    } catch (error: any) {
        console.error(error)
        return res.status(500)
            .json({
                success: false,
                message: error.message,
            })

    }
}


export async function sendVerificationEmail(req: Request, res: Response) {
    try {
        // Fetching the user id from the frontend and check it is exist or not. 
        const { userId,type } = req.body

        if (!userId) {
            return res.status(404)
                .json({
                    success: false,
                    message: "User id is required to send the email."
                })
        }

        if(!type){
            return res.status(404)
            .json({
                success: false,
                message: "Email type is required"
            })
        }

        // Check user is exists or not. 
        const user = await prisma.user.findFirst({
            where: {
                id: userId
            }
        })

        if (!user) {
            return res.status(400)
                .json({
                    success: false,
                    message: "User does not exists"
                })
        }

        // Email Sending function call 
        const response = await sendEmail({ emailId: user.email, emailType: type, userId: user.id })

        if (response.status !== 200) {
            return res.status(500)
                .json({
                    success: false,
                    message: "Error while sending the email"
                })
        }

        return res.status(200).json({
            success: true,
            message: "Email sended successfully"
        })

    } catch (error: any) {
        return res.status(500)
            .json({
                success: false,
                message: error.message
            })

    }
}


export async function getUserProfile(req: Request, res: Response) {
    try {
        // Fetch the user profile using the user id or email id. 
        const { userid, email } = req.body

        if (!userid && !email) {
            return res.status(404)
                .json({
                    success: false,
                    message: "User id or Email id is required"
                })
        }

        // Check user exists or not.
        const user = await prisma.user.findFirst({
            where: {
                OR: [{ id: userid }, { email: email }]
            }
        })

        if (!user) {
            return res.status(400)
                .json({
                    success: false,
                    message: "User does not exists"
                })
        }

        return res.status(200)
            .json({
                success: true,
                message: "User profile fetched successfully",
                userData: user
            })

    } catch (error: any) {
        console.error(error)
        return res.status(500)
            .json({
                success: false,
                message: error.message
            })

    }
}

export async function verifyUser(req: Request, res: Response){
    try {
        const userId = req.params.userId
        const {verificationCode} = req.body

        // Check that the user id is passed in params. 
        if(!userId){
            return res.status(404)
            .json({
                success: false,
                message: "User id is required"
            })
        }

        // Check that the user exist or not with this user id or not.
        const isUserExist = await prisma.user.findFirst({
            where:{
                id: userId
            }
        })

        if(!isUserExist){
            return res.status(400)
            .json({
                success: false,
                message: "User does not exist with this user id"
            })
        }
        // Check verification code/ otp is given or not. If given, is it correct and given in certain time limit of 15 minutes.
        if(!verificationCode){
            return res.status(400)
            .json({
                success: false,
                message: "verification code is required for verification."
            })
        }
        if(!isUserExist.verificationCode){
            return res.status(404)
            .json({
                success: false,
                message: "Verification code is expired, please generate the new verification code."
            })
        }

        if(verificationCode!==isUserExist.verificationCode){
            return res.status(400)
            .json({
                success: false,
                message: "Verification code is incorrect."
            })
        }


        if(isUserExist.verificationCodeExpiry && new Date(Date.now())> new Date(isUserExist.verificationCodeExpiry)){
            return res.status(404)
            .json({
                success: false,
                message: "Verification code is expired, please generate the new verification code."
            })
        }


        const updatedUser = await prisma.user.update({
            where:{
                id: userId
            },
            data:{
                isVerified: true,
                verificationCode: null,
                verificationCodeExpiry: null
            }
        })

        return res.status(200)
        .json({
            success: true,
            message: "User Verified successfully"
        })

        
    } catch (error:any) {
        console.log(error)
        return res.status(500)
        .json({
            success: false,
            message: error.message
        })
        
    }
}

export async function loginUser(req: Request, res: Response) {
    try {
        // Login functionality using the email or mobile number. 
        // Check that user has provided the email, mobile number and password or not. 
        const {email, mobileNo,password} = req.body
        
        if(!email && !mobileNo){
            return res.status(404)
            .json({
                success: false,
                message: "Email or Mobile number is required"
            })
        }

        if(!password){
            return res.status(404)
            .json({
                success: false,
                message: "Password is required for login"
            })
        }

        // Check that user exists or not. 
        const isUserExist = await prisma.user.findFirst({
            where:{
                OR:[
                    {email: email},
                    {mobileNo: mobileNo}
                ]
            }
        })

        if(!isUserExist){
            return res.status(400)
            .json({
                success: false,
                message: "User does not exists with this email id or mobile number"
            })
        }   
        // Check that the existed user is verified or not. 
        if(!isUserExist.isVerified){
            return res.status(400)
            .json({
                success: false,
                message: "User is not verified"
            })
        }

        // Check that the password is correct or not. 
        const isPasswordCorrect = await bcrypt.compare(password,isUserExist.password)

        if(!isPasswordCorrect){
            return res.status(400)
            .json({
                success: false,
                message: "Incorrect Password"
            })
        }
        // Generate the tokens for cookies. 
        const accessToken = signAccessToken({id: isUserExist.id, email: isUserExist.email, mobileNo: isUserExist.mobileNo})
        const refreshToken = signRefreshToken({id: isUserExist.id, email: isUserExist.email, mobileNo: isUserExist.mobileNo})

        // Update the refresh Token in the database. 
        const updatedUser = await prisma.user.update({
            where:{
                id: isUserExist.id
            },
            data:{
                refreshToken: refreshToken
            },
            omit:{
                password: true,
                refreshToken: true
            }
        })



        return res.status(200)
        .cookie("accessToken",accessToken,{
        httpOnly: true,
        secure: true,
        })
        .cookie("refreshToken",refreshToken,{
            httpOnly: true,
            secure: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        })
        .json({
            sucess: true,
            message: "User logged in successfully",
            userData: updatedUser
        })

        
    } catch (error:any) {
        console.error(error)
        return res.status(500)
        .json({
            success: false,
            message: error.message
        })
        
    }
}

export async function updatePassword(req: Request, res: Response){
    try {

        // Check that the user id is provided or not. 
        const userId = req.params.userId

        if(!userId){
            return res.status(404)
            .json({
                success: false,
                message: "User id is required"
            })
        }
        console.log(req.user)
        if(userId!==req.user.id){
            return res.status(400)
            .json({
                success: false,
                message: "Logged in user and the user id does not match"
            })
        }

        // Check that the newPassword and confirm Password is provided or not. 
        const {oldPassword, newPassword,confirmPassword} = req.body
        if(!oldPassword || !newPassword || !confirmPassword){
            return res.status(404)
            .json({
                success: false,
                message: "Old Password,New Password and confirmPassword is required"
            })
        }

        // Check that both are equal
        if(newPassword!==confirmPassword){
            return res.status(400)
            .json({
                success: false,
                message: "New Password and confirm Password does not match."
            })
        }

        const isUserExist = req.user

        // Check that the old password is correct. 
        const isPasswordCorrect = await bcrypt.compare(oldPassword, isUserExist.password)

        if(!isPasswordCorrect){
            return res.status(400)
            .json({
                success: false,
                message: "Old Password is incorrect."
            })
        }

        // Now encrypt the new Password and update it in database.
        const hashedPassword = await bcrypt.hash(newPassword,10);

        const updatedUser = await prisma.user.update({
            where:{
                id: userId
            },
            data:{
                password: hashedPassword
            }
        })

        return res.status(200)
        .json({
            success: true,
            message: "User password updated successfully"
        })

        
    } catch (error:any) {
        console.log(error)
        return res.status(500)
        .json({
            success: false,
            message: error.message || "Server Error while updating the password"
        })
        
    }
}

export async function updateAccessToken(req: Request, res: Response){
    try {
        // Check the incoming refresh token from the frontend.
        const incomingRefreshToken= req.cookies?.refreshToken || req.body.refreshToken

        if(!incomingRefreshToken){
            return res.status(400)
            .json({
                success: false,
                message: "Invalid Refresh Token"
            })
        }   

        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET!) as JwtPayload

        const user = await prisma.user.findFirst({
            where:{
                id: decodedToken?.id
            }
        })

        if(!user){
            return res.status(400)
            .json({
                success: false,
                message: "Invalid refresh token"
            })
        }

        if(incomingRefreshToken!== user?.refreshToken){
            return res.status(400)
            .json({
                success: false,
                message: "Refresh Token is expired or used."
            })
        }

        // Generate the tokens for cookies. 
        const accessToken = signAccessToken({id: user.id, email: user.email, mobileNo: user.mobileNo})
        const refreshToken = signRefreshToken({id: user.id, email: user.email, mobileNo: user.mobileNo})

        // Update the refresh Token in the database. 
        const updatedUser = await prisma.user.update({
            where:{
                id: user.id
            },
            data:{
                refreshToken: refreshToken
            },
            omit:{
                password: true,
                refreshToken: true
            }
        })

       return res.status(200)
        .cookie("accessToken",accessToken,{
        httpOnly: true,
        secure: true,
        })
        .cookie("refreshToken",refreshToken,{
            httpOnly: true,
            secure: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        })
        .json({
            success: true,
            userData: updatedUser,
            message: "Access token and refresh token updated successfully"
        })


        
    } catch (error:any) {
        console.log(error)
        return res.status(500)
        .json({
            success: false,
            message: error.message || "Server error while updating the access token"
        })
        
    }
}

export async function LogoutUser(req: Request,res: Response){
    try {
        // Check that the user is logged in or not. 
        const user  = req.user

        if(!user){
            return res.status(400)
            .json({
                success: false,
                message: "Unauthorized Request"
            })
        }

        // Remove the Refresh Token from the database.
        const updatedUser = await prisma.user.update({
            where:{
                id: user.id
            },
            data:{
                refreshToken: null
            }
        })
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
            message: "User logged out successfully"
        })

        
    } catch (error:any) {
        console.log(error)
        return res.status(500)
        .json({
            success: false,
            message: error.message || "Error while logout"
        })
        
    }
}

export async function getLoggedInUser(req: Request,res: Response){
    try {
        const loggedInUser = req.user
        if(!loggedInUser){
            return res.status(400)
            .json({
                success: false,
                message: "User is not logged in."
            })
        }

        delete loggedInUser.password
        delete loggedInUser.refreshToken

        return res.status(200)
        .json({
            success: true,
            message: "User Profile fetched successfully",
            userData: loggedInUser
        })

    } catch (error:any) {
        console.log(error)
        return res.status(400)
        .json({
            success: false,
            message: error.message || "Server error while fetching logged in user"
        })
        
    }
}