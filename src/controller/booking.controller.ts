import type { NextFunction, Request, Response } from "express";
import prisma from "../lib/prisma";
import { Gender } from "../generated/prisma";
import puppeteer from "puppeteer";
import path from "path";
import handlebars from "handlebars";
import fs from "fs-extra"
import { fileURLToPath } from "url";
import nodemailer from "nodemailer"
import type { Bus, busStop } from "./bus.controller";
import Razorpay from "razorpay";
import { confirmBooking } from "../webhook/razorpay.webook";

// 📌 We have to ensure that if the ticket is already booked then we have to book the another seat. 


type passenger = {
    id: string,
    name: string,
    age: number,
    gender: String,
}

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!
})


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
        const { busId, passengersList, emailId, phoneNo, emergencyContactNumber, boardingStationId, destinationStopId, amountPaid, seatsBooked } = req.body

        if (!busId || !passengersList || !emailId || !phoneNo || !boardingStationId || !destinationStopId || !amountPaid || !seatsBooked) {
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

        const isBoardingStopExist = busStopList.find(stop => stop.id === parseInt(boardingStationId))
        const isDestinationStopExist = busStopList.find(stop => stop.id === parseInt(destinationStopId))

        if (!isBoardingStopExist || !isDestinationStopExist) {
            return res.status(400)
                .json({
                    success: false,
                    message: "Boarding Stop or Destination Stop is wrong"
                })
        }

        // Now check that the amount paid by user is actually equal to the prices or not. 
        const amountToPay = isDestinationStopExist.ticketPrice - isBoardingStopExist.ticketPrice

        if (amountToPay !== parseFloat(amountPaid.toString())) {
            return res.status(400)
                .json({
                    success: false,
                    message: "Amount paid is not correct."
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
                emergencyContactNumber: emergencyContactNumber,
                bookedSeatNumber: seatsBooked
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
        let index = 0;
        // Register passengers in the bus. 
        passengersList.map(async (passengerDetails: passenger) => {
            if (!passengerDetails.name || !passengerDetails.age || !passengerDetails.gender) {
                return res.status(404)
                    .json({
                        success: false,
                        message: "All fields are required for passengers"
                    })
            }
            let passengerGender;
            if (passengerDetails.gender === "male") passengerGender = Gender.Male;
            else if (passengerDetails.gender === "female") passengerGender = Gender.Female
            else passengerGender = Gender.Other

            if (seatMatrixToUpdate[seatsBooked[index - 1]] === true) {
                for (let i = 0; i < seatMatrixToUpdate.length; i++) {
                    if (seatMatrixToUpdate[i] === false) {
                        seatMatrixToUpdate[i] = true;
                        seatsBooked[index - 1] = i;
                    }
                }
            }
            else {
                seatMatrixToUpdate[seatsBooked[index - 1]] = true;
            }

            const passengerRegistration = await prisma.passenger.create({
                data: {
                    passengerName: passengerDetails.name,
                    age: parseInt(passengerDetails.age.toString()),
                    gender: passengerGender,
                    bookingId: booking.id,
                }
            })

            if (!passengerRegistration) {
                return res.status(500)
                    .json({
                        success: false,
                        message: "Error while registering. "
                    })
            }
            index++
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

        // now update the booking. 
        const updatedBooking = await prisma.booking.update({
            where: {
                id: booking.id
            },
            data: {
                bookedSeatNumber: seatsBooked
            }
        })

        // Payment flow
        const order = await razorpay.orders.create({
            amount: booking.amountPaid * 100,
            currency: "INR",
            receipt: `receipt-${Date.now()}`,
            notes: {
                bookingId: booking.id
            }
        })

        // Send Email

        // Now we have to send the booking of the passengers.
        const bookingData = await prisma.booking.update({
            where: {
                id: booking.id
            },
            data: {
                razorpayId: order.id,
            },
            include: {
                boardingStation: true,
                destinationStop: true,
                PassengersList: true,
                bookingUser: true,
                bus: true
            }
        })


        return res.status(200)
            .json({
                success: true,
                message: "Ticket Booked successfully",
                bookingData: bookingData
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


function reassignSeats(
    requestedSeats: number[],
    seatMatrix: boolean[]
): number[] {
    const updatedSeats: number[] = [];
    const usedSeats = new Set<number>();

    for (let seat of requestedSeats) {
        // If requested seat is free → use it
        if (seatMatrix[seat] === false && !usedSeats.has(seat)) {
            updatedSeats.push(seat);
            usedSeats.add(seat);
            continue;
        }

        // Else find next free seat
        const freeSeatIndex = seatMatrix.findIndex(
            (s, idx) => s === false && !usedSeats.has(idx)
        );

        if (freeSeatIndex === -1) {
            throw new Error("No available seats left");
        }

        updatedSeats.push(freeSeatIndex);
        usedSeats.add(freeSeatIndex);
    }

    return updatedSeats;
}


export async function createBookingAndOrder(req: Request, res: Response) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const {
            busId,
            passengersList,
            boardingStationId,
            destinationStopId,
            seatsBooked,
            emailId, phoneNo, emergencyContactNumber
        } = req.body;

        if (!busId || !passengersList || !boardingStationId || !destinationStopId || !seatsBooked || !emailId || !phoneNo) {
            return res.status(400).json({ success: false, message: "Missing fields" });
        }

        // 1️⃣ Fetch bus + stops
        const bus = await prisma.bus.findUnique({
            where: { id: busId },
            include: { busDetails: { include: { stops: true } } },
        });

        if (!bus) {
            return res.status(404).json({ success: false, message: "Bus not found" });
        }

        const boarding = bus.busDetails.stops.find(s => s.id === Number(boardingStationId));
        const destination = bus.busDetails.stops.find(s => s.id === Number(destinationStopId));

        if (!boarding || !destination) {
            return res.status(400).json({ success: false, message: "Invalid stops" });
        }

        const amountToPay = destination.ticketPrice - boarding.ticketPrice;

        let finalSeats: number[];

        try {
            finalSeats = reassignSeats(seatsBooked, bus.seatMatrix);
        } catch (err: any) {
            return res.status(409).json({
                success: false,
                message: "Not enough seats available",
            });
        }


        // 3️⃣ Create PENDING booking
        const booking = await prisma.booking.create({
            data: {
                busId,
                userBookingId: user.id,
                boardingStationId: boarding.id,
                destinationStopId: destination.id,
                amountPaid: amountToPay,
                bookedSeatNumber: finalSeats,
                emailId: emailId,
                mobileNumber: phoneNo,
                emergencyContactNumber: emergencyContactNumber
            },
        });

        // 4️⃣ Create Razorpay order
        const order = await razorpay.orders.create({
            amount: amountToPay * 100,
            currency: "INR",
        });

        // 5️⃣ Save order id
        await prisma.booking.update({
            where: { id: booking.id },
            data: { razorpayId: order.id },
        });

        // Just for test mode.

        await confirmBooking({ bookingId: booking.id });

        return res.status(200).json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            bookingId: booking.id,
            assignedSeats: finalSeats,
            seatChanged: JSON.stringify(finalSeats) !== JSON.stringify(seatsBooked),
        });

    } catch (error: any) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message || "Order creation failed",
        });
    }
}



export async function cancelBooking(req: Request, res: Response) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User is not logged in",
      });
    }

    const bookingId = (req.params.bookingId);

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    // 1️⃣ Fetch booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { bus: true },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // 2️⃣ Ownership check
    if (booking.userBookingId !== user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to cancel this booking",
      });
    }

    // 3️⃣ Idempotency
    if (booking.status === "CANCELLED") {
      return res.status(200).json({
        success: true,
        message: "Booking already cancelled",
      });
    }

    if (booking.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking with status ${booking.status}`,
      });
    }

    // 4️⃣ Free seats
    const seatMatrix = [...booking.bus.seatMatrix];
    for (const seat of booking.bookedSeatNumber) {
      seatMatrix[seat] = false;
    }

    await prisma.bus.update({
      where: { id: booking.busId },
      data: { seatMatrix },
    });

    // 5️⃣ Refund payment (IMPORTANT)
    if (booking.paymentId) {
      await razorpay.payments.refund(booking.paymentId, {
        amount: booking.amountPaid * 100, // in paise
      });
    }

    // 6️⃣ Update booking status
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "CANCELLED",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Booking cancelled and refund initiated",
    });

  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error while cancelling booking",
    });
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
            where: {
                id: bookingId
            },
            include: {
                bus: true,
                bookingUser: true,
            }
        })

        if (!booking) {
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
            attachments: [
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


export async function fetchUserBookings(req: Request, res: Response) {
    try {
        const userId = req.params.userId

        if (!userId) {
            return res.status(400)
                .json({
                    success: false,
                    message: "User id is required"
                })
        }

        const user = await prisma.user.findFirst({
            where: {
                id: userId
            },
            include: {
                bookings: {
                    include: {
                        bus: {
                            include: {
                                busDetails: {
                                    include: {
                                        stops: true
                                    }
                                }
                            }
                        },
                        PassengersList: true,
                        boardingStation: true,
                        destinationStop: true,
                    }
                }
            }
        })

        if (!user) {
            return res.status(400)
                .json({
                    success: false,
                    message: "User does not exist."
                })
        }

        // Sort stops for each bus by arrivalTime
        user.bookings.map((booking) => {
            booking.bus.busDetails.stops.sort((a, b) => {
                // Use "00:00" as default if arrivalTime is undefined
                const [ah = 0, am = 0] = (a.arrivalTime ?? "00:00").split(":").map(Number);
                const [bh = 0, bm = 0] = (b.arrivalTime ?? "00:00").split(":").map(Number);

                if (ah !== bh) return ah - bh;
                return am - bm;
            })
        })

        return res.status(200)
            .json({
                success: true,
                message: "Booking fetched successfully",
                bookings: user.bookings
            })
    } catch (error: any) {
        console.log(error)
        return res.status(500)
            .json({
                success: false,
                message: error.message || "Server error while fetching bookings."
            })

    }
}


export async function updateBusIssue(req: Request, res: Response) {
    try {
        const busId = req.params.busId
        const { busIssue, descriptions } = req.body


        if (!busId) {
            return res.status(404)
                .json({
                    success: false,
                    message: "Bus id is required"
                })
        }

        if (!busIssue) {
            return res.status(404)
                .json({
                    success: false,
                    message: "bus issue is required"
                })
        }

        const bus = await prisma.bus.update({
            where: {
                id: busId
            },
            data: {
                issue: busIssue,
                issudeDescription: descriptions
            }
        })

        if (!bus) {
            return res.status(400)
                .json({
                    success: false,
                    message: "Bus does not exist with this id"
                })
        }

        return res.status(200)
            .json({
                success: true,
                message: "Bus Detail update successfully",
                busDetail: bus
            })

    } catch (error: any) {
        console.log(error)
        return res.status(500)
            .json({
                success: false,
                message: error.message || "Server error while updating bus issue"
            })

    }
}


