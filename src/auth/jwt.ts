import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";

const tokenPayloadSchema = z.object({ userId: z.string() });

export type TokenPayload = z.infer<typeof tokenPayloadSchema>;

function parseExpiryToMs(expiry: string): number {
  const match = expiry.match(/^(\d+)([dhms])$/);
  if (!match) return 7 * 86_400_000;
  const value = parseInt(match[1], 10);
  const units: Record<string, number> = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000 };
  return value * (units[match[2]] ?? units.d);
}

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
  return new Date(Date.now() + parseExpiryToMs(env.JWT_REFRESH_EXPIRES_IN));
}
