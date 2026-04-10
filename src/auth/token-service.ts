import jwt, { SignOptions } from "jsonwebtoken";
import { getSSMParameter } from "../config/ssm";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

let cachedSecret: string | null = null;

async function getJwtSecret(): Promise<string> {
  if (cachedSecret) {
    return cachedSecret;
  }

  cachedSecret =
    process.env.JWT_SECRET ||
    (await getSSMParameter("/fiap-soat/jwt/secret"));

  if (!cachedSecret) {
    throw new Error("JWT secret is missing");
  }

  return cachedSecret;
}

export function generateToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT secret is missing");
  }

  const expiresIn = (process.env.JWT_EXPIRES_IN || "24h") as SignOptions["expiresIn"];

  return jwt.sign(payload, secret, { expiresIn });
}

export async function generateTokenAsync(payload: JwtPayload): Promise<string> {
  const secret = await getJwtSecret();
  const expiresIn = (process.env.JWT_EXPIRES_IN || "24h") as SignOptions["expiresIn"];

  return jwt.sign(payload, secret, { expiresIn });
}
