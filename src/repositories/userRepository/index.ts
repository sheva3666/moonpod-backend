import type { Prisma, AccountType, UserStatus } from "@prisma/client";
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

type CreateMemberData = CreateUserData & {
  nickName?: string | null;
  designation?: string | null;
  status?: UserStatus;
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
    prisma.user.findUnique({ where: { email }, include: { company: true, roles: { include: { role: true } } } }),

  // Returns fields needed for authorization and company scoping.
  findCurrentUser: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      select: { companyId: true, accountType: true },
    }),

  findByIdWithCompany: (id: string) =>
    prisma.user.findUnique({ where: { id }, include: { company: true, roles: { include: { role: true } } } }),

  findManyByCompany: (companyId: string) =>
    prisma.user.findMany({
      where: { companyId },
      include: { company: true, roles: { include: { role: true } } },
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
    prisma.user.create({ data, include: { company: true, roles: { include: { role: true } } } }),

  createMember: (data: CreateMemberData) =>
    prisma.user.create({
      data,
      include: {
        company: true,
        skills: true,
        pay: true,
        nextOfKin: true,
        notes: true,
        documents: true,
        prompts: true,
        roles: { include: { role: true } },
      },
    }),

  updateMember: (id: string, data: Prisma.UserUpdateInput, roleIds?: string[]) =>
    prisma.user.update({
      where: { id },
      data: {
        ...data,
        ...(roleIds !== undefined ? {
          roles: {
            deleteMany: {},
            create: roleIds.map((roleId) => ({ roleId })),
          },
        } : {}),
      },
      include: {
        company: true,
        skills: true,
        pay: true,
        nextOfKin: true,
        notes: true,
        documents: true,
        prompts: true,
        roles: { include: { role: true } },
      },
    }),

  updatePassword: (id: string, hashedPassword: string) =>
    prisma.user.update({ where: { id }, data: { password: hashedPassword } }),

  deleteMember: (id: string) =>
    prisma.user.delete({ where: { id } }),
};
