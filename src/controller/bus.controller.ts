import type { Request, Response } from "express";
import prisma from "../lib/prisma";

export type busStop =  {
  id: string,
  busStopName: string,
  ticketPrice: number,
  distance: number,
  busId: string,
  bus: Bus,
  arrivalTime: string,
//   departureTime: Date
}

export type Bus ={
    id: string,
    busName: string,
    busNumber: string,
    seatMatrix: Boolean[],
    rating: number,
    stops: busStop[],
    lat: number,
    lng: number
}

export async function registerBus(req:Request,res: Response){
    try {
        // Take the following values from the frontend. 
        // Here busStopList should all the data from the frontend as assigned in the type.
        const {busName,busNumber,busStopList,totalSeats} = req.body

        // Check if all the values are provided or not.
        if(!busName || !busNumber || !busStopList || !totalSeats){
            return res.status(404)
            .json({
                success: false,
                message: "All fields are required"
            })
        }

        // Check that the bus already exist with the bus number or busName
        const isBusExist = await prisma.bus.findFirst({
            where:{
                busNumber: busNumber,
            }
        })

        if(isBusExist){
            return res.status(400)
            .json({
                success: false,
                message: "Bus with this number already exists. "
            })
        }
        
        const seatMatrix = Array(totalSeats).fill(false)

        const busCreated = await prisma.bus.create({
            data:{
                busName: busName,
                busNumber: busNumber,
                seatMatrix: seatMatrix
            }
        })

        if(!busCreated){
            return res.status(500)
            .json({
                success: false,
                message: "Error while registering the bus."
            })
        }


        busStopList.map(async (busStop:busStop) =>{
            const createdBusStop = await prisma.busStop.create({
                data:{
                    busStopName: busStop.busStopName,
                    ticketPrice: busStop.ticketPrice,
                    distance: busStop.distance,
                    busId: busCreated.id,
                    arrivalTime: busStop.arrivalTime
                }
            })
            if(!createdBusStop){
                return res.status(500)
                .json({
                    success: false,
                    message: "Error while creating the bus stop. Please again create the bus entry"
                })
            }
        })

        // Bus data to send
        const busInformation = await prisma.bus.findFirst({
            where: {
                id: busCreated.id
            },
            include:{
                stops: true,
            }
        })

        return res.status(200)
        .json({
            success: true,
            message: "Bus registered successfully",
            busData: busInformation
        })

        
        
    } catch (error:any) {
        console.log(error)
        return res.status(500)
        .json({
            success: false,
            message: error.message || "Server error while registering bus."
        })
        
    }
}   