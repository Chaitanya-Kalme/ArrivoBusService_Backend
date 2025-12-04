import { Auth } from "@auth/core";
import Credentials from "@auth/core/providers/credentials"
import prisma from "./prisma";
import { signAccessToken, signRefreshToken } from "./jwt";



export async function AuthProvider(req: Request, res: Response) {
  const response = await Auth(req, {
    secret: process.env.AUTH_SECRET!,

    session: { strategy: "jwt" },

    providers: [
      Credentials({
        name: "Credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          mobileNo: { label: "mobileNo", type: "mobileNo" },
          password: { label: "Password", type: "password" }
        },
        async authorize(credentials) {
          const email = credentials.email || ""
          const mobileNo = credentials.mobileNo || ""
          const password = credentials.password

          if (!email && !mobileNo) {
            throw new Error("Email or Mobile Number is required for login")
          }
          if (!password) {
            throw new Error("Password is required for login")
          }

          const checkUserExist = await prisma.user.findFirst({
            where: {
              OR: [
                { email: email },
                { mobileNo: mobileNo }
              ]
            }
          })

          if (!checkUserExist) {
            throw new Error("User does not Exists with this Email id or Mobile number")
          }

          if (checkUserExist.isVerified === false) {
            throw new Error("User is not Verified. Please verify your Email")
          }

          return {
            id: checkUserExist.id,
            userName: checkUserExist.userName,
            email: checkUserExist.email,
            emailVerified: checkUserExist.isVerified
          }

        }
      })
    ],

    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id;
          token.userName = user.userName;
          token.email = user.email ?? null;
          token.emailVerified = user.emailVerified ?? false;

          token.accessToken = signAccessToken({ id: user.id, email: user.email, userName: token.userName });
          token.refreshToken = signRefreshToken({ id: user.id, email: user.email, userName: token.userName });
        }
        return token;
      },

      async session({ session, token }) {
        session.user = {
          id: token.id as string,
          email: token.email as string,
          userName: token.userName as string,
          emailVerified: token.emailVerified as (Date & boolean), 
        };

        session.accessToken = token.accessToken as string;
        session.refreshToken = token.refreshToken as string;
        return session;
      }

    }
  });

  // Extract session from Auth.js response
  const text = await response.text();
  const json = JSON.parse(text || "{}");

  if (json.accessToken) {
    // Store JWT in HttpOnly cookie
    res.cookie("auth_token", json.accessToken, {
      httpOnly: true,
      secure: true, // make false for localhost in dev if needed
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 1000, // 1 hour
    });
  }

  res.status(response.status || 200);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(text);
}

export const auth = (req: Request) => Auth(req, authConfig);