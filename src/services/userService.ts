import { GraphQLError } from "graphql";
import type { Prisma } from "@prisma/client";
import type { AppContext } from "../context.js";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

export type TeamMembersArgs = {
  page?: number | null;
  pageSize?: number | null;
  sortField?: string | null;
  sortDirection?: string | null;
  search?: string | null;
};

export type TeamMemberDto = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  pin: string;
  status: string;
  accountType: string;
  roles: string[];
  createdAt: string;
};

export type TeamMembersResult = {
  members: TeamMemberDto[];
  total: number;
};

export const userService = {
  async getTeamMembers(
    { prisma, userId }: AppContext,
    args: TeamMembersArgs,
  ): Promise<TeamMembersResult> {
    if (!userId) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });

    if (!currentUser) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, args.pageSize ?? DEFAULT_PAGE_SIZE));
    const skip = (page - 1) * pageSize;
    const direction = (args.sortDirection ?? "DESC").toLowerCase() as "asc" | "desc";
    const orderBy = buildOrderBy(args.sortField ?? "CREATED_AT", direction);

    const searchFilter = buildSearchFilter(args.search);
    const where: Prisma.UserWhereInput = { companyId: currentUser.companyId, ...searchFilter };

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        include: { roles: { include: { role: true } } },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      members: users.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        pin: u.pin,
        status: u.status,
        accountType: u.accountType,
        roles: u.roles.map((ur) => ur.role.name),
        createdAt: u.createdAt.toISOString(),
      })),
      total,
    };
  },
};

function buildSearchFilter(search?: string | null): Prisma.UserWhereInput {
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

function buildOrderBy(field: string, direction: "asc" | "desc"): Prisma.UserOrderByWithRelationInput {
  const map: Record<string, Prisma.UserOrderByWithRelationInput> = {
    FIRST_NAME: { firstName: direction },
    LAST_NAME: { lastName: direction },
    EMAIL: { email: direction },
    STATUS: { status: direction },
    ACCOUNT_TYPE: { accountType: direction },
  };
  return map[field] ?? { createdAt: direction };
}
