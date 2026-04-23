import type { Prisma, AccountType } from "@prisma/client";
import { prisma } from "../../db.js";

type CreateUserData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  pin: string;
  accountType: AccountType;
  companyId: string;
};

type FindMembersOptions = {
  orderBy: Prisma.UserOrderByWithRelationInput;
  skip: number;
  take: number;
};

export const userRepository = {
  findByEmail: (email: string) =>
    prisma.user.findUnique({ where: { email }, select: { id: true } }),

  findByEmailWithCompany: (email: string) =>
    prisma.user.findUnique({ where: { email }, include: { company: true } }),

  // Returns fields needed for authorization and company scoping.
  findCurrentUser: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      select: { companyId: true, accountType: true },
    }),

  findByIdWithCompany: (id: string) =>
    prisma.user.findUnique({ where: { id }, include: { company: true } }),

  findManyByCompany: (companyId: string) =>
    prisma.user.findMany({
      where: { companyId },
      include: { company: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),

  findMember: (id: string, companyId: string) =>
    prisma.user.findFirst({
      where: { id, companyId },
      include: {
        company: true,
        skills: true,
        pay: true,
        nextOfKin: true,
        notes: true,
        documents: true,
        prompts: true,
        roles: { include: { role: true } },
        locations: { include: { location: true } },
      },
    }),

  // Atomic find + count so both see the same data snapshot.
  findMembersWithCount: (where: Prisma.UserWhereInput, options: FindMembersOptions) =>
    prisma.$transaction([
      prisma.user.findMany({
        where,
        include: { roles: { include: { role: true } } },
        ...options,
      }),
      prisma.user.count({ where }),
    ]),

  create: (data: CreateUserData) =>
    prisma.user.create({ data, include: { company: true } }),

  updatePassword: (id: string, hashedPassword: string) =>
    prisma.user.update({ where: { id }, data: { password: hashedPassword } }),
};
