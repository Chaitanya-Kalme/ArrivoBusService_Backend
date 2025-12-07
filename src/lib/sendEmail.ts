import nodemailer from "nodemailer"
import prisma from "./prisma";

export const sendEmail = async({emailId,userId,emailType}:{emailId: string,userId:string,emailType:string}) =>{
    try {
        var transporter = nodemailer.createTransport({
            host: process.env.MAILTRAP_HOST,
            port: Number(process.env.MAILTRAP_PORT),
            auth: {
                user: process.env.MAILTRAP_USER,
                pass: process.env.MAILTRAP_PASS
            }
        });

        // Creating verification code and verification code expiry date and time, 3600000 is in millisecond.
        const verificationCode = Math.floor(Math.random() * 1000000)
            .toString()
            .padStart(6, '0');

        const verificationCodeExpiry = new Date(Date.now() + 900000);

        //  finding user and updating user on different type of email.
        let user;
        let mailOption = {};

        if (emailType === "VERIFY") {
            user = await prisma.user.update({
                where: {
                    id: userId
                },
                data: {
                    verificationCode: verificationCode,
                    verificationCodeExpiry: verificationCodeExpiry
                }
            })

            const verificationMailContent = `<!DOCTYPE html>
                    <html lang="en">
                    <head>
                    <meta charset="UTF-8" />
                    <title>Your OTP Code</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <style>
                        /* Reset some basic styles for email clients */
                        body, p, h2 {
                        margin: 0;
                        padding: 0;
                        }
                        body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background-color: #f7fafc;
                        color: #1a202c;
                        }
                        .container {
                        max-width: 500px;
                        background-color: #ffffff;
                        margin: 40px auto;
                        border-radius: 12px;
                        padding: 40px 30px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                        text-align: center;
                        }
                        h2 {
                        font-weight: 700;
                        margin-bottom: 8px;
                        }
                        p {
                        font-size: 16px;
                        color: #4a5568;
                        margin-bottom: 24px;
                        }
                        .otp-code {
                        margin: 30px 0;
                        padding: 15px 0;
                        font-size: 36px;
                        font-weight: 700;
                        letter-spacing: 8px;
                        color: #2b6cb0;
                        background-color: #ebf8ff;
                        border-radius: 8px;
                        font-family: 'Courier New', Courier, monospace;
                        user-select: all;
                        display: inline-block;
                        width: 100%;
                        max-width: 280px;
                        margin-left: auto;
                        margin-right: auto;
                        }
                        .small-text {
                        font-size: 14px;
                        color: #718096;
                        margin-bottom: 16px;
                        }
                        hr {
                        border: none;
                        border-top: 1px solid #e2e8f0;
                        margin: 32px 0;
                        }
                        .footer {
                        font-size: 12px;
                        color: #a0aec0;
                        }
                    </style>
                    </head>
                    <body>
                    <div class="container">
                        <h2>Hello, ${user.userName} </h2>
                        <p>Use the following One-Time Password (OTP) to verify your identity:</p>
                        <div class="otp-code">${verificationCode}</div>
                        <p class="small-text">This code will expire in 15 minutes.</p>
                        <p class="small-text">Visit this link to verify OTP:<a href="${process.env.WEBSITE_DOMAIN?.toString()}/verifyotp/${user.id}">Link</a> </p>
                        <p class="small-text">If you didn’t request this, please ignore this email.</p>
                        <hr />
                        <p class="footer">&copy; 2025 ArrivoBusService. All rights reserved.</p>
                    </div>
                    </body>
                    </html>
                    `

            mailOption = {
                from: process.env.EMAIL_SENDING_DOMAIN,
                to: emailId,
                subject: "Verify Your Email",
                html: verificationMailContent
            }
        }
        else if (emailType === "RESET") {
            user = await prisma.user.update({
                where: {
                    id: userId
                },
                data: {
                    resetPasswordCode: verificationCode,
                    resetPasswordCodeExpiry: verificationCodeExpiry
                }
            })

            const verificationMailContent = `<!DOCTYPE html>
                    <html lang="en">
                    <head>
                    <meta charset="UTF-8" />
                    <title>Your OTP Code</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <style>
                        /* Reset some basic styles for email clients */
                        body, p, h2 {
                        margin: 0;
                        padding: 0;
                        }
                        body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background-color: #f7fafc;
                        color: #1a202c;
                        }
                        .container {
                        max-width: 500px;
                        background-color: #ffffff;
                        margin: 40px auto;
                        border-radius: 12px;
                        padding: 40px 30px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                        text-align: center;
                        }
                        h2 {
                        font-weight: 700;
                        margin-bottom: 8px;
                        }
                        p {
                        font-size: 16px;
                        color: #4a5568;
                        margin-bottom: 24px;
                        }
                        .otp-code {
                        margin: 30px 0;
                        padding: 15px 0;
                        font-size: 36px;
                        font-weight: 700;
                        letter-spacing: 8px;
                        color: #2b6cb0;
                        background-color: #ebf8ff;
                        border-radius: 8px;
                        font-family: 'Courier New', Courier, monospace;
                        user-select: all;
                        display: inline-block;
                        width: 100%;
                        max-width: 280px;
                        margin-left: auto;
                        margin-right: auto;
                        }
                        .small-text {
                        font-size: 14px;
                        color: #718096;
                        margin-bottom: 16px;
                        }
                        hr {
                        border: none;
                        border-top: 1px solid #e2e8f0;
                        margin: 32px 0;
                        }
                        .footer {
                        font-size: 12px;
                        color: #a0aec0;
                        }
                    </style>
                    </head>
                    <body>
                    <div class="container">
                        <h2>Hello, ${user.userName} </h2>
                        <p>Use the following One-Time Password (OTP) to reset your password:</p>
                        <div class="otp-code">${verificationCode}</div>
                        <p class="small-text">This code will expire in 15 minutes.</p>
                        <p class="small-text">If you didn’t request this, please ignore this email.</p>
                        <hr />
                        <p class="footer">&copy; 2025 ArrivoBusService. All rights reserved.</p>
                    </div>
                    </body>
                    </html>
                    `

            mailOption = {
                from: process.env.EMAIL_SENDING_DOMAIN,
                to: emailId,
                subject: "Reset Password for Account",
                html: verificationMailContent
            }
        }
        else {
            throw Error("Email type is not valid.")
        }

        // Email Send logic
        const mailResponse = await transporter.sendMail(mailOption)
        const reponse = {
            status: 200,
            message: mailResponse
        }
        return reponse;

        
    } catch (error:any) {
        console.error(error);
        const response = {
            status: 500,
            message: error.message || "Error while sending email",
        }
        return response
        
    }
}