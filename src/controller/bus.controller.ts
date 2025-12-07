import type { Request, Response } from "express";
import prisma from "../lib/prisma";

export type busStop =  {
  id: string,
  busStopName: string,
  ticketPrice: number,
  distance: number,
  busId: string,
  bus: BusDetails,
  arrivalTime: string,
}

export type BusDetails ={
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
        const isBusExist = await prisma.busDetails.findFirst({
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
        

        const busCreated = await prisma.busDetails.create({
            data:{
                busName: busName,
                busNumber: busNumber,
                totalSeats: totalSeats
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
                    busDetailsId: busCreated.id,
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
        const busInformation = await prisma.busDetails.findFirst({
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


export async function getHomePageBusDetails(req:Request, res: Response){
    try {
        const demoBusDetails = await prisma.bus.findMany({
            where:{
                dateAndTime: {
                    gt: new Date()
                }
            },
            take:10,
        })

        if(!demoBusDetails){
            return res.status(500)
            .json({
                success: false,
                message: "Errow while getting the bus details"
            })
        }

        return res.status(200)
        .json({
            success: true,
            message: "Bus Detaills fetched successfully",
            busDetails: demoBusDetails
        })
        
    } catch (error:any) {
        console.log(error)
        return res.status(500)
        .json({
            success: false,
            message: error.message || "Error while getting the bus details"
        })
    }
}

export async function createBusTrip(req: Request, res: Response){
    try {
        // Get the bus details id, date and time from frontend.
        const {busDetailId, dateAndTime} = req.body

        if(!busDetailId || !dateAndTime){
            return res.status(404)
            .json({
                success: false,
                message: "Bus Details Id, Date and Time is required"
            })
        }

        // Check that the bus Detail entry exist or not.
        const isBusDetailsExist = await prisma.busDetails.findFirst({
            where:{
                id: busDetailId,
            }
        })

        if(!isBusDetailsExist){
            return res.status(400)
            .json({
                success: false,
                message: "Bus Details does not exist."
            })
        }

        // Check that the bus Entry already exist with this date and time. 
        const isBusAlreadyExist = await prisma.bus.findFirst({
            where:{
                busDetailsId: busDetailId,
                dateAndTime: dateAndTime
            }
        })

        if(isBusAlreadyExist){
            return res.status(400)
            .json({
                success: false,
                message: "bus already exist with this date and time and busDetailsId"
            })
        }
        // Now Create the seat matrix for the bus. 
        const seatMatrix: boolean[] = Array(isBusDetailsExist.totalSeats).fill(false)


        // Now create bus 
        const busCreated = await prisma.bus.create({
            data:{
                busDetailsId: busDetailId,
                dateAndTime: dateAndTime,
                seatMatrix: seatMatrix                
            }
        })


        return res.status(200)
        .json({
            success: false,
            message: "Bus Created successfully",
            busData: busCreated
        })
        
        
    } catch (error:any) {
        console.log(error)
        return res.status(500)
        .json({
            success: false,
            message: error.message || "Error while creating bus trip"
        })
        
    }
}