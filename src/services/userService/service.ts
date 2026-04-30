import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { GraphQLError } from "graphql";
import type { Prisma, AccountType, UserStatus } from "@prisma/client";
import type { AppContext } from "../../context.js";
import type { UserWithCompany } from "../../types.js";
import type {
  CreateTeamMemberInput,
  TeamMembersArgs,
  TeamMembersResult,
  UpdateTeamMemberInput,
} from "./types.js";
import { buildOrderBy, buildSearchFilter, buildFilterWhere } from "./utils.js";
import { userRepository } from "../../repositories/userRepository/index.js";
import { roleRepository } from "../../repositories/roleRepository/index.js";

const SALT_ROUNDS = 12;

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

const PRIVILEGED_ROLES = ["OWNER", "MANAGER", "ADMIN"] as const;

export const userService = {
  async checkEmail(
    _ctx: AppContext,
    { email }: { email: string },
  ): Promise<{ exists: boolean }> {
    const user = await userRepository.findByEmail(email);
    return { exists: user !== null };
  },

  async getMe({ userId }: AppContext): Promise<UserWithCompany> {
    if (!userId) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    const user = await userRepository.findByIdWithCompany(userId);
    if (!user) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    return user;
  },

  async getUsers({ userId }: AppContext): Promise<UserWithCompany[]> {
    if (!userId) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    const currentUser = await userRepository.findCurrentUser(userId);
    if (!currentUser) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    return userRepository.findManyByCompany(currentUser.companyId);
  },

  async getTeamMember({ userId }: AppContext, { id }: { id: string }) {
    if (!userId) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    const currentUser = await userRepository.findCurrentUser(userId);
    if (!currentUser) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    const member = await userRepository.findMember(id, currentUser.companyId);
    if (!member) return null;

    const canViewSensitive =
      userId === id ||
      (PRIVILEGED_ROLES as readonly string[]).includes(currentUser.accountType);

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

  async getTeamMembers(
    { userId }: AppContext,
    args: TeamMembersArgs,
  ): Promise<TeamMembersResult> {
    if (!userId) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    const currentUser = await userRepository.findCurrentUser(userId);
    if (!currentUser) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, args.pageSize ?? DEFAULT_PAGE_SIZE),
    );
    const skip = (page - 1) * pageSize;
    const direction = (args.sortDirection ?? "DESC").toLowerCase() as
      | "asc"
      | "desc";
    const orderBy = buildOrderBy(args.sortField ?? "CREATED_AT", direction);

    const searchFilter = buildSearchFilter(args.search);
    const filterWhere = buildFilterWhere(args.filter);
    const extraClauses: Prisma.UserWhereInput[] = [
      searchFilter,
      filterWhere,
    ].filter((c) => Object.keys(c).length > 0);
    const where: Prisma.UserWhereInput = {
      companyId: currentUser.companyId,
      ...(extraClauses.length > 0 ? { AND: extraClauses } : {}),
    };

    const [users, total] = await userRepository.findMembersWithCount(where, {
      orderBy,
      skip,
      take: pageSize,
    });

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

  async createTeamMember({ userId }: AppContext, input: CreateTeamMemberInput) {
    if (!userId) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    const currentUser = await userRepository.findCurrentUser(userId);
    if (!currentUser) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    if (
      !(PRIVILEGED_ROLES as readonly string[]).includes(currentUser.accountType)
    ) {
      throw new GraphQLError("Forbidden", {
        extensions: { code: "FORBIDDEN" },
      });
    }

    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new GraphQLError("Email already in use", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const [hashedPin, hashedPassword] = await Promise.all([
      bcrypt.hash(input.pin, SALT_ROUNDS),
      bcrypt.hash(randomBytes(32).toString("hex"), SALT_ROUNDS),
    ]);

    return userRepository.createMember({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      password: hashedPassword,
      pin: hashedPin,
      accountType: (input.accountType ?? "EMPLOYEE") as AccountType,
      nickName: input.nickName ?? null,
      designation: input.designation ?? null,
      companyId: currentUser.companyId,
    });
  },

  async updateTeamMember(
    { userId }: AppContext,
    id: string,
    input: UpdateTeamMemberInput,
  ) {
    if (!userId) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    const currentUser = await userRepository.findCurrentUser(userId);
    if (!currentUser) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    const canUpdate =
      userId === id ||
      (PRIVILEGED_ROLES as readonly string[]).includes(currentUser.accountType);
    if (!canUpdate) {
      throw new GraphQLError("Forbidden", {
        extensions: { code: "FORBIDDEN" },
      });
    }

    const member = await userRepository.findMember(id, currentUser.companyId);
    if (!member) {
      throw new GraphQLError("Member not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    const data: Prisma.UserUpdateInput = mapUser(input);

    if (input.roleIds != null && input.roleIds.length > 0) {
      const validRoles = await roleRepository.findManyByIds(input.roleIds, currentUser.companyId);
      if (validRoles.length !== input.roleIds.length) {
        throw new GraphQLError("One or more roles not found", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
    }

    return userRepository.updateMember(
      id,
      data,
      input.roleIds !== undefined && input.roleIds !== null ? input.roleIds : undefined,
    );
  },

  async deleteTeamMember({ userId }: AppContext, id: string): Promise<boolean> {
    if (!userId) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    const currentUser = await userRepository.findCurrentUser(userId);
    if (!currentUser) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    if (!(PRIVILEGED_ROLES as readonly string[]).includes(currentUser.accountType)) {
      throw new GraphQLError("Forbidden", {
        extensions: { code: "FORBIDDEN" },
      });
    }

    const member = await userRepository.findMember(id, currentUser.companyId);
    if (!member) {
      throw new GraphQLError("Member not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    await userRepository.deleteMember(id);
    return true;
  },
};

const mapUser = (input: UpdateTeamMemberInput) => {
  const data: Prisma.UserUpdateInput = {};
  data.firstName = input.firstName ?? undefined;
  if (input.lastName != null) data.lastName = input.lastName;
  if ("nickName" in input) data.nickName = input.nickName ?? null;
  if ("designation" in input) data.designation = input.designation ?? null;
  if (input.accountType != null)
    data.accountType = input.accountType as AccountType;
  if (input.status != null) data.status = input.status as UserStatus;
  if ("phone" in input) data.phone = input.phone ?? null;
  if ("dateOfBirth" in input)
    data.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  if ("address" in input) data.address = input.address ?? null;
  if (input.isKeyHolder != null) data.isKeyHolder = input.isKeyHolder;
  return data;
};
