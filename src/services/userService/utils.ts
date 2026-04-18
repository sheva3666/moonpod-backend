import type { Prisma } from "@prisma/client";

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
