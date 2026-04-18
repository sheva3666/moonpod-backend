import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";

const tokenPayloadSchema = z.object({ userId: z.string() });

export type TokenPayload = z.infer<typeof tokenPayloadSchema>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  return tokenPayloadSchema.parse(decoded);
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  return tokenPayloadSchema.parse(decoded);
}

export function getRefreshTokenExpiry(): Date {
  const days = parseInt(env.JWT_REFRESH_EXPIRES_IN) || 7;
  return new Date(Date.now() + days * MS_PER_DAY);
}
