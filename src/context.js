import { prisma } from "./db.js";
import { verifyAccessToken } from "./auth/jwt.js";

export function createContext({ req }) {
  let userId = null;

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
