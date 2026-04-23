import { prisma } from "../../db.js";

type CreateRefreshTokenData = {
  token: string;
  userId: string;
  expiresAt: Date;
};

export const authRepository = {
  createRefreshToken: (data: CreateRefreshTokenData) =>
    prisma.refreshToken.create({ data }),

  findRefreshToken: (token: string) =>
    prisma.refreshToken.findUnique({
      where: { token },
      select: { expiresAt: true, userId: true },
    }),

  // Strict delete — throws if token is not found. Use for rotation.
  deleteRefreshToken: (token: string) =>
    prisma.refreshToken.delete({ where: { token } }),

  // Soft delete — silent if already gone. Use for logout.
  revokeRefreshToken: (token: string) =>
    prisma.refreshToken.deleteMany({ where: { token } }),

  revokeAllRefreshTokens: (userId: string) =>
    prisma.refreshToken.deleteMany({ where: { userId } }),

  // Atomic: delete old token and create new one in a single transaction.
  rotateRefreshToken: (oldToken: string, newToken: string, userId: string, expiresAt: Date) =>
    prisma.$transaction([
      prisma.refreshToken.delete({ where: { token: oldToken } }),
      prisma.refreshToken.create({ data: { token: newToken, userId, expiresAt } }),
    ]),
};
