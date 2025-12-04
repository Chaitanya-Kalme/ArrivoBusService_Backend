import jwt from "jsonwebtoken";



export function signAccessToken(payload: object) {
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET!, {
    expiresIn: parseInt(process.env.ACCESS_TOKEN_EXPIRES!),
  });
}

export function signRefreshToken(payload: object) {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET!, {
    expiresIn: parseInt(process.env.REFRESH_TOKEN_EXPIRES!),
  });
}

export function verifyAccessToken(token: string){
  return jwt.verify(token,process.env.ACCESS_TOKEN_SECRET!)
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!);
}
