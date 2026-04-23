import { prisma } from "../../db.js";

type CreatePasswordResetData = {
  token: string;
  userId: string;
  expiresAt: Date;
};

export const passwordResetRepository = {
  findByToken: (token: string) =>
    prisma.passwordResetToken.findUnique({
      where: { token },
      select: { id: true, userId: true, used: true, expiresAt: true },
    }),

  invalidateAll: (userId: string) =>
    prisma.passwordResetToken.updateMany({ where: { userId, used: false }, data: { used: true } }),

  create: (data: CreatePasswordResetData) =>
    prisma.passwordResetToken.create({ data }),

  // Atomic: mark token used, invalidate remaining tokens, update password, revoke all sessions.
  performReset: (tokenId: string, userId: string, hashedPassword: string) =>
    prisma.$transaction([
      prisma.passwordResetToken.update({ where: { id: tokenId }, data: { used: true } }),
      prisma.passwordResetToken.updateMany({ where: { userId, used: false }, data: { used: true } }),
      prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } }),
      prisma.refreshToken.deleteMany({ where: { userId } }),
    ]),
};
