import crypto from "crypto";
import bodyParser from "body-parser";
import prisma from "../lib/prisma";
import type { Request, Response } from "express";

export const razorpayWebhook = [
  bodyParser.raw({ type: "application/json" }),

  async (req: Request, res: Response) => {
    const signature = req.headers["x-razorpay-signature"] as string;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(req.body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString());

    if (event.event !== "payment.captured") {
      return res.json({ status: "ignored" });
    }

    const payment = event.payload.payment.entity;
    const bookingId = payment.notes.bookingId;

    const booking = await prisma.booking.findUnique({
      where: { id: (bookingId) },
      include: { bus: true, PassengersList: true },
    });

    if (!booking || booking.status === "CONFIRMED") {
      return res.json({ status: "ok" });
    }

    // 1️⃣ Permanently mark seats
    const seatMatrix = [...booking.bus.seatMatrix];
    booking.bookedSeatNumber.forEach(seat => {
      seatMatrix[seat] = true;
    });

    await prisma.bus.update({
      where: { id: booking.busId },
      data: { seatMatrix },
    });

    // 2️⃣ Create passengers
    for (const p of booking.PassengersList) {
      await prisma.passenger.create({
        data: {
          passengerName: p.passengerName,
          age: Number(p.age),
          gender: p.gender,
          bookingId: booking.id,
        },
      });
    }

    // 3️⃣ Confirm booking
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "CONFIRMED",
        paymentId: payment.id,
      },
    });

    return res.json({ success: true });
  },
];

interface ConfirmBookingParams {
  bookingId: string;
  paymentId?: string; // optional in test mode
}

export async function confirmBooking({ bookingId, paymentId }: ConfirmBookingParams) {
  // 1️⃣ Fetch booking with bus and passenger list
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { bus: true, PassengersList: true },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status === "CONFIRMED") {
    console.log("Booking already confirmed");
    return;
  }

  // 2️⃣ Permanently mark seats
  const seatMatrix = [...booking.bus.seatMatrix];
  booking.bookedSeatNumber.forEach(seat => {
    seatMatrix[seat] = true;
  });

  await prisma.bus.update({
    where: { id: booking.busId },
    data: { seatMatrix },
  });

  // 3️⃣ Create passengers
  for (const p of booking.PassengersList) {
    await prisma.passenger.create({
      data: {
        passengerName: p.passengerName,
        age: Number(p.age),
        gender: p.gender,
        bookingId: booking.id,
      },
    });
  }
  console.log(bookingId)
  // 4️⃣ Confirm booking
  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "CONFIRMED",
      // paymentId: paymentId || "TEST_PAYMENT_ID", // optional in test mode
    },
  });

  console.log(`Booking ${bookingId} confirmed manually`);
}