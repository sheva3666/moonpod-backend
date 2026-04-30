import { prisma } from "../../db.js";

type CreateMagicLinkData = {
  token: string;
  userId: string;
  expiresAt: Date;
};

export const magicLinkRepository = {
  findByToken: (token: string) =>
    prisma.magicLinkToken.findUnique({
      where: { token },
      include: { user: { include: { company: true, roles: { include: { role: true } } } } },
    }),

  findRecentUnused: (userId: string) =>
    prisma.magicLinkToken.findFirst({
      where: {
        userId,
        used: false,
        expiresAt: { gt: new Date(Date.now() - 60_000) },
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
    }),

  invalidateAll: (userId: string) =>
    prisma.magicLinkToken.updateMany({ where: { userId, used: false }, data: { used: true } }),

  markUsed: (id: string) =>
    prisma.magicLinkToken.update({ where: { id }, data: { used: true } }),

  create: (data: CreateMagicLinkData) =>
    prisma.magicLinkToken.create({ data }),
};
