import type { Request } from "express";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "./db.js";
import { verifyAccessToken } from "./auth/jwt.js";

export type AppContext = {
  prisma: PrismaClient;
  userId: string | null;
};

export async function createContext({ req }: { req: Request }): Promise<AppContext> {
  let userId: string | null = null;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const decoded = verifyAccessToken(token);
      userId = decoded.userId;
    } catch {
      // Token invalid or expired — userId stays null
    }
  }

  return { prisma, userId };
}
