import { GraphQLError } from "graphql";
import type { Prisma } from "@prisma/client";
import type { AppContext } from "../../context.js";
import type { UserWithCompany } from "../../types.js";
import type { TeamMembersArgs, TeamMembersResult } from "./types.js";
import { buildOrderBy, buildSearchFilter, buildFilterWhere } from "./utils.js";
import { userRepository } from "../../repositories/userRepository/index.js";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

const PRIVILEGED_ROLES = ["OWNER", "MANAGER", "ADMIN"] as const;

export const userService = {
  async checkEmail(_ctx: AppContext, { email }: { email: string }): Promise<{ exists: boolean }> {
    const user = await userRepository.findByEmail(email);
    return { exists: user !== null };
  },

  async getMe({ userId }: AppContext): Promise<UserWithCompany> {
    if (!userId) {
      throw new GraphQLError("Not authenticated", { extensions: { code: "UNAUTHENTICATED" } });
    }
    const user = await userRepository.findByIdWithCompany(userId);
    if (!user) {
      throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
    }
    return user;
  },

  async getUsers({ userId }: AppContext): Promise<UserWithCompany[]> {
    if (!userId) {
      throw new GraphQLError("Not authenticated", { extensions: { code: "UNAUTHENTICATED" } });
    }
    const currentUser = await userRepository.findCurrentUser(userId);
    if (!currentUser) {
      throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
    }
    return userRepository.findManyByCompany(currentUser.companyId);
  },

  async getTeamMember({ userId }: AppContext, { id }: { id: string }) {
    if (!userId) {
      throw new GraphQLError("Not authenticated", { extensions: { code: "UNAUTHENTICATED" } });
    }
    const currentUser = await userRepository.findCurrentUser(userId);
    if (!currentUser) {
      throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
    }

    const member = await userRepository.findMember(id, currentUser.companyId);
    if (!member) return null;

    const canViewSensitive =
      userId === id || (PRIVILEGED_ROLES as readonly string[]).includes(currentUser.accountType);

    if (canViewSensitive) return member;

    return {
      ...member,
      pay: null,
      notes: [] as typeof member.notes,
      documents: [] as typeof member.documents,
      prompts: [] as typeof member.prompts,
      nextOfKin: [] as typeof member.nextOfKin,
    };
  },

  async getTeamMembers({ userId }: AppContext, args: TeamMembersArgs): Promise<TeamMembersResult> {
    if (!userId) {
      throw new GraphQLError("Not authenticated", { extensions: { code: "UNAUTHENTICATED" } });
    }
    const currentUser = await userRepository.findCurrentUser(userId);
    if (!currentUser) {
      throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
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

    const [users, total] = await userRepository.findMembersWithCount(where, { orderBy, skip, take: pageSize });

    return {
      members: users.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        status: u.status,
        accountType: u.accountType,
        roles: u.roles.map((ur) => ur.role.name),
        createdAt: u.createdAt.toISOString(),
      })),
      total,
    };
  },
};
