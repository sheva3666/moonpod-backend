import { GraphQLError } from "graphql";
import type { Prisma } from "@prisma/client";
import type { AppContext } from "../../context.js";
import type { UserWithCompany } from "../../types.js";
import type { TeamMembersArgs, TeamMembersResult } from "./types.js";
import { buildOrderBy, buildSearchFilter, buildFilterWhere } from "./utils.js";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

export const userService = {
  async checkEmail(
    { prisma }: AppContext,
    { email }: { email: string },
  ): Promise<{ exists: boolean }> {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    return { exists: user !== null };
  },

  async getMe(
    { prisma, userId }: AppContext,
  ): Promise<UserWithCompany> {
    if (!userId) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });
    if (!user) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    return user;
  },

  async getUsers(
    { prisma, userId }: AppContext,
  ): Promise<UserWithCompany[]> {
    if (!userId) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    return prisma.user.findMany({
      include: { company: true },
      orderBy: { createdAt: "desc" },
      take: MAX_PAGE_SIZE,
    });
  },

  async getTeamMember(
    { prisma, userId }: AppContext,
    { id }: { id: string },
  ) {
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

    const member = await prisma.user.findFirst({
      where: { id, companyId: currentUser.companyId },
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
    });

    return member ?? null;
  },

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
    const filterWhere = buildFilterWhere(args.filter);
    const extraClauses: Prisma.UserWhereInput[] = [searchFilter, filterWhere].filter(
      (c) => Object.keys(c).length > 0,
    );
    const where: Prisma.UserWhereInput = {
      companyId: currentUser.companyId,
      ...(extraClauses.length > 0 ? { AND: extraClauses } : {}),
    };

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
