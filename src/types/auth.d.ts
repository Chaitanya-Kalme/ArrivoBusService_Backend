import "@auth/core/types"

// Defining the data types for the Json Web token and Session 
declare module "@auth/core/types" {
    interface User {
        id: string;
        email: string | null;
        userName: string;
        emailVerified?: boolean;
    }
    interface JWT {
        id: string
        email: string | null;
        userName: string
        emailVerified?: boolean
        accessToken?: string;
        refreshToken?: string;
    }

    interface Session {
        user: {
            id: string
            email: string
            userName: string
            emailVerified?: boolean
        }
        accessToken: string,
        refreshToken: string

    }
}