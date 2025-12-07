import type { NextFunction, Request, Response } from "express";
import prisma from "../lib/prisma";
import { Gender } from "../generated/prisma";
import puppeteer from "puppeteer";
import path from "path";
import handlebars from "handlebars";
import fs from "fs-extra"
import { fileURLToPath } from "url";
import nodemailer from "nodemailer"

// 📌 We have to ensure that if the ticket is already booked then we have to book the another seat. 


type passenger = {
    id: string,
    passengerName: string,
    age: number,
    gender: String,
    bookedSeatNumber: number
}


export async function registerBooking(req: Request, res: Response) {
    try {
        // Check that the user is logged in or not via middlewar. 
        const user = req.user

        if (!user) {
            return res.status(400)
                .json({
                    success: false,
                    message: "User is not logged in"
                })
        }

        //  Now check that data taken from the frontend. 
        const { busId, passengersList, emailId, phoneNo, emergencyContactNumber, boardingStationId, destinationStopId, amountPaid } = req.body

        if (!busId || !passengersList || !emailId || !phoneNo || !boardingStationId || !destinationStopId || !amountPaid) {
            return res.status(404)
                .json({
                    success: false,
                    message: "All fields are required"
                })
        }

        // Check that bus exist with this bus id or not.
        const isBusExist = await prisma.bus.findFirst({
            where: {
                id: busId
            },
            include: {
                busDetails: {
                    include: {
                        stops: true
                    }
                }
            }
        })

        if (!isBusExist) {
            return res.status(400)
                .json({
                    success: false,
                    message: "Bus does not available. "
                })
        }

        // Check boarding station id exist with this bus. 
        const busStopList = isBusExist.busDetails.stops

        const isBoardingStopExist = busStopList.some(stop => stop.id === parseInt(boardingStationId))
        const isDestinationStopExist = busStopList.some(stop => stop.id === parseInt(destinationStopId))

        if (!isBoardingStopExist || !isDestinationStopExist) {
            return res.status(400)
                .json({
                    success: false,
                    message: "Boarding Stop or Destination Stop is wrong"
                })
        }

        const booking = await prisma.booking.create({
            data: {
                busId: busId,
                userBookingId: req.user.id,
                boardingStationId: parseInt(boardingStationId),
                destinationStopId: parseInt(destinationStopId),
                amountPaid: parseFloat(amountPaid),
                emailId: emailId,
                mobileNumber: phoneNo,
                emergencyContactNumber: emergencyContactNumber
            }
        })


        if (!booking) {
            return res.status(500)
                .json({
                    success: false,
                    message: "Error while booking the ticket "
                })
        }

        // Array of booked seat number
        let seatMatrixToUpdate: boolean[] = isBusExist.seatMatrix;

        // Register passengers in the bus. 
        passengersList.map(async (passengerDetails: passenger) => {
            if (!passengerDetails.passengerName || !passengerDetails.age || !passengerDetails.gender) {
                return res.status(404)
                    .json({
                        success: false,
                        message: "All fields are required for passengers"
                    })
            }
            let passengerGender;
            if (passengerDetails.gender === "Male") passengerGender = Gender.Male;
            else if (passengerDetails.gender === "Female") passengerGender = Gender.Female
            else passengerGender = Gender.Other
            seatMatrixToUpdate[passengerDetails.bookedSeatNumber] = true;

            const passengerRegistration = await prisma.passenger.create({
                data: {
                    passengerName: passengerDetails.passengerName,
                    age: passengerDetails.age,
                    gender: passengerGender,
                    bookingId: booking.id,
                    bookedSeatNumber: passengerDetails.bookedSeatNumber
                }
            })

            if (!passengerRegistration) {
                return res.status(500)
                    .json({
                        success: false,
                        message: "Error while registering. "
                    })
            }
        })

        // Now update the seat matrix of bus.
        const updatedBus = await prisma.bus.update({
            where: {
                id: busId
            },
            data: {
                seatMatrix: seatMatrixToUpdate
            }
        })


        // Payment flow



        return res.status(200)
            .json({
                success: true,
                message: "Ticket Booked successfully"
            })


    } catch (error: any) {
        console.log(error)
        return res.status(500)
            .json({
                success: false,
                message: error.message || "Error while booking ticket"
            })
    }

}


export async function cancelBooking(req: Request, res: Response, next: NextFunction) {
    try {
        // Check that the user is logged in or not. 
        const user = req.user

        if (!user) {
            return res.status(400)
                .json({
                    success: false,
                    message: "User is not logged in"
                })
        }


        // Fetch the booking id from the frontend.
        const bookingId = req.params.bookingId

        if (!bookingId) {
            return res.status(404)
                .json({
                    success: false,
                    message: "Booking Id is required to cancel booking"
                })
        }

        // Now Check that the booking exist or not.
        const isBookingExist = await prisma.booking.findFirst({
            where: {
                id: bookingId
            },
            include: {
                bus: true,
                PassengersList: true
            }
        })

        if (!isBookingExist) {
            return res.status(400)
                .json({
                    success: false,
                    message: "Ticket booking does not exist with this booking id"
                })
        }

        // Now find the seats occupied by this booking. 
        const seatMatrix = isBookingExist.bus.seatMatrix

        isBookingExist.PassengersList.map((passenger) => {
            seatMatrix[passenger.bookedSeatNumber] = false;
        })

        const updatedBus = await prisma.bus.update({
            where: {
                id: isBookingExist.busId
            },
            data: {
                seatMatrix: seatMatrix
            }
        })


        // Delete booking
        await prisma.booking.delete({
            where: {
                id: bookingId
            }
        })

        req.bookingId = bookingId
        next()
    } catch (error: any) {
        console.log(error)
        return null;

    }
}


export async function sendEmailforBooking(req: Request, res: Response) {
    try {
        // Fetch the booking id from params.
        const bookingId = req.params.bookingId

        if (!bookingId) {
            return res.status(404)
                .json({
                    success: false,
                    message: "Booking Id is required."
                })
        }

        const booking = await prisma.booking.findFirst({
            where:{
                id: bookingId
            },
            include:{
                bus: true,
                bookingUser: true,
            }
        })

        if(!booking){
            return res.status(200)
            .json({
                success: false,
                message: "Booking does not exist with this id"
            })
        }

        const data = {
            name: "Hello",
            email: "example1@example.com",
            amount: 15
        }

        // Create the pdf of ticket.
        const __filename = fileURLToPath(import.meta.url);

        // __dirname equivalent
        const __dirname = path.dirname(__filename);
        const templatePath = path.join(__dirname, "../lib/InvoiceTemplate.html");
        const templateHtml = await fs.readFile(templatePath, "utf8")

        // Compile template with handlebars
        const template = handlebars.compile(templateHtml);
        const finalHtml = template(data);

        // Launch browser to convert HTML -> PDF
        const browser = await puppeteer.launch({
            headless: true,
        });
        const page = await browser.newPage();
        await page.setContent(finalHtml);

        const pdfBuffer = await page.pdf({ format: "A4" });
        await browser.close();

        // Send Email here
        var transporter = nodemailer.createTransport({
            host: process.env.MAILTRAP_HOST,
            port: Number(process.env.MAILTRAP_PORT),
            auth: {
                user: process.env.MAILTRAP_USER,
                pass: process.env.MAILTRAP_PASS
            }
        });


        // Content to send. Should be html /css format
        const emailContent = ``

        const mailOption = {
            from: process.env.EMAIL_SENDING_DOMAIN,
            to: booking?.emailId,
            subject: "Verify Your Email",
            html: emailContent,
            attachments:[
                {
                    filename: `${booking.id}.pdf`,
                    content: Buffer.from(pdfBuffer),
                    contentType: "application/pdf"
                }
            ]
        }

        const mailResponse = await transporter.sendMail(mailOption)

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=invoice.pdf`);
        res.status(200).send(pdfBuffer);


    } catch (error: any) {
        console.log(error)
        return res.status(500)
            .json({
                success: false,
                message: "Error while sending email of booking"
            })

    }
}



export async function sendEmailForCancellation(req: Request, res: Response) {
    try {
        const bookingId = req.bookingId

        if (!bookingId) {
            return res.status(404)
                .json({
                    success: false,
                    message: "Error while deleting the booking"
                })
        }

        const booking = await prisma.booking.findFirst({
            where: {
                id: bookingId
            },
            include: {
                bus: true,
                PassengersList: true,
            }
        })

        if (booking) {
            return res.status(500)
                .json({
                    success: false,
                    message: "Error while deleting the booking, please retry"
                })
        }


        // Send Email Here


        return res.status(200)
            .json({
                success: true,
                message: "Ticket cancellation email send successfully"
            })

    } catch (error: any) {
        console.log(error)
        return res.status(500)
            .json({
                success: false,
                message: error.message || "Server error while sending the cancellation email"
            })
    }
}




