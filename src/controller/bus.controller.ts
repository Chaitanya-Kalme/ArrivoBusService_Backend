import type { Request, Response } from "express";
import prisma from "../lib/prisma";

export type busStop = {
    id: string,
    busStopName: string,
    ticketPrice: number,
    distance: number,
    busId: string,
    bus: BusDetails,
    arrivalTime: string,
}

export type BusDetails = {
    id: string,
    busName: string,
    busNumber: string,
    rating: number,
    stops: busStop[],
}

export type Bus = {
    id: string,
    busDetailsId: string,
    busDetails: BusDetails,
    seatMatrix: boolean[],
    dateAndTime: Date,
    lat: number,
    lng: number
}


export async function registerBus(req: Request, res: Response) {
    try {
        // Take the following values from the frontend. 
        // Here busStopList should all the data from the frontend as assigned in the type.
        const { busName, busNumber, busStopList, totalSeats } = req.body

        // Check if all the values are provided or not.
        if (!busName || !busNumber || !busStopList || !totalSeats) {
            return res.status(404)
                .json({
                    success: false,
                    message: "All fields are required"
                })
        }

        // Check that the bus already exist with the bus number or busName
        const isBusExist = await prisma.busDetails.findFirst({
            where: {
                busNumber: busNumber,
            }
        })

        if (isBusExist) {
            return res.status(400)
                .json({
                    success: false,
                    message: "Bus with this number already exists. "
                })
        }


        const busCreated = await prisma.busDetails.create({
            data: {
                busName: busName,
                busNumber: busNumber,
                totalSeats: totalSeats
            }
        })

        if (!busCreated) {
            return res.status(500)
                .json({
                    success: false,
                    message: "Error while registering the bus."
                })
        }


        busStopList.map(async (busStop: busStop) => {
            const createdBusStop = await prisma.busStop.create({
                data: {
                    busStopName: busStop.busStopName,
                    ticketPrice: busStop.ticketPrice,
                    distance: busStop.distance,
                    busDetailsId: busCreated.id,
                    arrivalTime: busStop.arrivalTime
                }
            })
            if (!createdBusStop) {
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
            include: {
                stops: true,
            }
        })

        return res.status(200)
            .json({
                success: true,
                message: "Bus registered successfully",
                busData: busInformation
            })



    } catch (error: any) {
        console.log(error)
        return res.status(500)
            .json({
                success: false,
                message: error.message || "Server error while registering bus."
            })

    }
}


export async function getHomePageBusDetails(req: Request, res: Response) {
    try {
        const demoBusDetails = await prisma.bus.findMany({
            where: {
                dateAndTime: {
                    gt: new Date()
                }
            },
            include: {
                busDetails: {
                    include: {
                        stops: true
                    }
                }
            },
            take: 10,
        })

        // Sort stops for each bus by arrivalTime
        demoBusDetails.forEach(bus => {
            if (bus.busDetails.stops && bus.busDetails.stops.length > 0) {
                bus.busDetails.stops.sort((a, b) => {
                    // Use "00:00" as default if arrivalTime is undefined
                    const [ah = 0, am = 0] = (a.arrivalTime ?? "00:00").split(":").map(Number);
                    const [bh = 0, bm = 0] = (b.arrivalTime ?? "00:00").split(":").map(Number);

                    if (ah !== bh) return ah - bh;
                    return am - bm;
                });
            }
        });

        if (!demoBusDetails) {
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

    } catch (error: any) {
        console.log(error)
        return res.status(500)
            .json({
                success: false,
                message: error.message || "Error while getting the bus details"
            })
    }
}

export async function createBusTrip(req: Request, res: Response) {
    try {
        // Get the bus details id, date and time from frontend.
        const { busDetailId, dateAndTime } = req.body

        if (!busDetailId || !dateAndTime) {
            return res.status(404)
                .json({
                    success: false,
                    message: "Bus Details Id, Date and Time is required"
                })
        }

        // Check that the bus Detail entry exist or not.
        const isBusDetailsExist = await prisma.busDetails.findFirst({
            where: {
                id: busDetailId,
            }
        })

        if (!isBusDetailsExist) {
            return res.status(400)
                .json({
                    success: false,
                    message: "Bus Details does not exist."
                })
        }

        // Check that the bus Entry already exist with this date and time. 
        const isBusAlreadyExist = await prisma.bus.findFirst({
            where: {
                busDetailsId: busDetailId,
                dateAndTime: new Date(dateAndTime)
            }
        })

        if (isBusAlreadyExist) {
            return res.status(400)
                .json({
                    success: false,
                    message: "bus already exist with this date and time and busDetailsId"
                })
        }
        // Now Create the seat matrix for the bus. 
        const seatMatrix: boolean[] = Array(isBusDetailsExist.totalSeats).fill(false)

        const dateTime: Date = new Date(dateAndTime)

        // Now create bus 
        const busCreated = await prisma.bus.create({
            data: {
                busDetailsId: busDetailId,
                dateAndTime: dateTime.toISOString(),
                seatMatrix: seatMatrix
            }
        })


        return res.status(200)
            .json({
                success: false,
                message: "Bus Created successfully",
                busData: busCreated
            })


    } catch (error: any) {
        console.log(error)
        return res.status(500)
            .json({
                success: false,
                message: error.message || "Error while creating bus trip"
            })

    }
}


export async function getSearchResultOfBus(req: Request, res: Response) {
    try {
        const fromLocation = req.params.fromLocation
        const toLocation = req.params.toLocation
        const date = req.params.date

        if (!date) {
            return res.status(400).json({
                success: false,
                message: "Date and Time are required"
            });
        }

        // Create local DateTime from date and searchTime
        const [year, month, day] = date.split("/").map(Number);
        if (!year || !month || !day) {
            return res.status(400)
                .json({
                    success: false,
                    message: "Date is not in correct format."
                })
        }


        const startOfDay = new Date(year, month - 1, day, 0, 0, 0); // 2025-12-10 00:00:00 local
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59); // 2025-12-10 23:59:59 local




        // Fetch buses with dateAndTime >= input
        let buses = await prisma.bus.findMany({
            where: {
                dateAndTime: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: {
                busDetails: {
                    include: {
                        stops: true
                    }
                }
            }
        });

        // Filter buses based on fromLocation and toLocation
        if (fromLocation || toLocation) {
            buses = buses.filter(bus =>
                // if stops array contains either fromLocation or toLocation
                bus.busDetails.stops.some(stop =>
                    stop.busStopName === fromLocation || stop.busStopName === toLocation
                )
            );

            // Sort stops for each bus by arrivalTime
            buses.forEach(bus => {
                if (bus.busDetails.stops && bus.busDetails.stops.length > 0) {
                    bus.busDetails.stops.sort((a, b) => {
                        // Use "00:00" as default if arrivalTime is undefined
                        const [ah = 0, am = 0] = (a.arrivalTime ?? "00:00").split(":").map(Number);
                        const [bh = 0, bm = 0] = (b.arrivalTime ?? "00:00").split(":").map(Number);

                        if (ah !== bh) return ah - bh;
                        return am - bm;
                    });
                }
            });

        }


        return res.status(200)
            .json({
                success: true,
                message: "Bus Search Result fetched successfully",
                buses: buses
            })

    } catch (error: any) {
        console.log(error)
        return res.status(500)
            .json({
                success: false,
                message: error.message || "Server error while searching bus."
            })

    }
}


export async function getBusDetailsById(req: Request, res: Response) {
    try {
        const busId = req.params.busId

        if (!busId) {
            return res.status(404)
                .json({
                    success: true,
                    message: "Bus id is required"
                })
        }

        const bus = await prisma.bus.findFirst({
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

        if(!bus){
            return res.status(400)
            .json({
                success: false,
                message: "Bus does not exist with this id"
            })
        }

        // Sort stops for each bus by arrivalTime
        bus.busDetails.stops.sort((a, b) => {
            // Use "00:00" as default if arrivalTime is undefined
            const [ah = 0, am = 0] = (a.arrivalTime ?? "00:00").split(":").map(Number);
            const [bh = 0, bm = 0] = (b.arrivalTime ?? "00:00").split(":").map(Number);

            if (ah !== bh) return ah - bh;
            return am - bm;
        });

        return res.status(200)
        .json({
            success: true,
            message :"Bus details fetched successfully",
            busDetails: bus
        })




    } catch (error: any) {
        console.log(error)
        return res.status(500)
            .json({
                success: false,
                message: error.message || "Server error while sending the information"
            })

    }
}


