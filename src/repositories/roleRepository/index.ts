import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";

type PermissionInput = {
  module: string;
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

type FindManyOptions = {
  skip: number;
  take: number;
  orderBy: Prisma.RoleOrderByWithRelationInput;
  search?: string | null;
};

type CreateData = {
  name: string;
  description?: string | null;
  otpAllowed?: boolean;
  permissions?: PermissionInput[];
  companyId: string;
};

type UpdateData = {
  name: string;
  description?: string | null;
  otpAllowed?: boolean;
  permissions?: PermissionInput[];
};

export const roleRepository = {
  async findManyWithCount(companyId: string, opts: FindManyOptions) {
    const where: Prisma.RoleWhereInput = {
      companyId,
      ...(opts.search ? { name: { contains: opts.search, mode: "insensitive" } } : {}),
    };
    return prisma.$transaction([
      prisma.role.findMany({ where, orderBy: opts.orderBy, skip: opts.skip, take: opts.take }),
      prisma.role.count({ where }),
    ]);
  },

  findByIdAndCompany(id: string, companyId: string) {
    return prisma.role.findFirst({ where: { id, companyId } });
  },

  findByName(companyId: string, name: string) {
    return prisma.role.findUnique({ where: { companyId_name: { companyId, name } } });
  },

  create(data: CreateData) {
    return prisma.role.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        otpAllowed: data.otpAllowed ?? false,
        permissions: (data.permissions ?? []) as Prisma.InputJsonValue,
        companyId: data.companyId,
      },
    });
  },

  update(id: string, data: UpdateData) {
    return prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description ?? null,
        otpAllowed: data.otpAllowed ?? false,
        permissions: (data.permissions ?? []) as Prisma.InputJsonValue,
      },
    });
  },

  delete(id: string) {
    return prisma.role.delete({ where: { id } });
  },
};
