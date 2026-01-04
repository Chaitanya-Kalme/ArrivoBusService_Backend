// src/types/express.d.ts
import { User } from "@prisma/client"; // assuming you use Prisma
import type { Driver } from "../generated/prisma";

declare global {
  namespace Express {
    interface Request {
      user?: User; // optional, because it may not exist on public routes
      bookingId? : string;
      driver?: Driver
    }
  }
}
