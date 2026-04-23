import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { TeamMembersFilter } from "./types.js";

const userStatusSchema = z.enum(["PENDING", "ACTIVE", "INACTIVE"]);
const accountTypeSchema = z.enum(["OWNER", "EMPLOYEE", "MANAGER", "ADMIN"]);

export function buildSearchFilter(search?: string | null): Prisma.UserWhereInput {
  if (!search?.trim()) return {};
  const term = search.trim();
  return {
    OR: [
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ],
  };
}

export function buildFilterWhere(filter?: TeamMembersFilter | null): Prisma.UserWhereInput {
  if (!filter) return {};
  const AND: Prisma.UserWhereInput[] = [];

  if (filter.firstName?.trim()) AND.push({ firstName: { contains: filter.firstName.trim(), mode: "insensitive" } });
  if (filter.lastName?.trim()) AND.push({ lastName: { contains: filter.lastName.trim(), mode: "insensitive" } });
  if (filter.email?.trim()) AND.push({ email: { contains: filter.email.trim(), mode: "insensitive" } });

  if (filter.status) {
    const parsed = userStatusSchema.safeParse(filter.status);
    if (parsed.success) AND.push({ status: parsed.data });
  }

  if (filter.accountType) {
    const parsed = accountTypeSchema.safeParse(filter.accountType);
    if (parsed.success) AND.push({ accountType: parsed.data });
  }

  if (filter.role?.trim()) AND.push({ roles: { some: { role: { name: { contains: filter.role.trim(), mode: "insensitive" } } } } });

  return AND.length > 0 ? { AND } : {};
}

export function buildOrderBy(field: string, direction: "asc" | "desc"): Prisma.UserOrderByWithRelationInput {
  const map: Record<string, Prisma.UserOrderByWithRelationInput> = {
    FIRST_NAME: { firstName: direction },
    LAST_NAME: { lastName: direction },
    EMAIL: { email: direction },
    STATUS: { status: direction },
    ACCOUNT_TYPE: { accountType: direction },
  };
  return map[field] ?? { createdAt: direction };
}
