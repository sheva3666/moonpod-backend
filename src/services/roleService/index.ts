import { GraphQLError } from "graphql";
import { Prisma } from "@prisma/client";
import type { AppContext } from "../../context.js";
import { userRepository } from "../../repositories/userRepository/index.js";
import { roleRepository } from "../../repositories/roleRepository/index.js";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

export type RolesArgs = {
  page?: number | null;
  pageSize?: number | null;
  sortField?: "NAME" | "CREATED_AT" | null;
  sortDirection?: "ASC" | "DESC" | null;
  search?: string | null;
};

type PermissionInput = {
  module: string;
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

function normalizeRole(role: Record<string, unknown>) {
  const raw = role.permissions;
  const permissions: PermissionInput[] = Array.isArray(raw) ? (raw as PermissionInput[]) : [];
  return { ...role, permissions };
}

function requireAuth(ctx: AppContext) {
  if (!ctx.userId) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
}

export const roleService = {
  async getRoles(ctx: AppContext, args: RolesArgs) {
    requireAuth(ctx);
    const currentUser = await userRepository.findCurrentUser(ctx.userId!);
    if (!currentUser) {
      throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
    }

    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, args.pageSize ?? DEFAULT_PAGE_SIZE));
    const skip = (page - 1) * pageSize;
    const dir = (args.sortDirection ?? "ASC").toLowerCase() as Prisma.SortOrder;
    const sortField = args.sortField ?? "NAME";
    const orderBy: Prisma.RoleOrderByWithRelationInput =
      sortField === "NAME" ? { name: dir } : { createdAt: dir };

    const [roles, total] = await roleRepository.findManyWithCount(currentUser.companyId, {
      skip,
      take: pageSize,
      orderBy,
      search: args.search,
    });

    return { roles: roles.map((r) => normalizeRole(r as unknown as Record<string, unknown>)), total };
  },

  async getRole(ctx: AppContext, id: string) {
    requireAuth(ctx);
    const currentUser = await userRepository.findCurrentUser(ctx.userId!);
    if (!currentUser) {
      throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
    }

    const role = await roleRepository.findByIdAndCompany(id, currentUser.companyId);
    if (!role) {
      throw new GraphQLError("Role not found", { extensions: { code: "NOT_FOUND" } });
    }

    return normalizeRole(role as unknown as Record<string, unknown>);
  },

  async createRole(
    ctx: AppContext,
    args: { name: string; description?: string | null; otpAllowed?: boolean | null; permissions?: PermissionInput[] | null },
  ) {
    requireAuth(ctx);
    const currentUser = await userRepository.findCurrentUser(ctx.userId!);
    if (!currentUser) {
      throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
    }

    const existing = await roleRepository.findByName(currentUser.companyId, args.name);
    if (existing) {
      throw new GraphQLError("A role with that name already exists", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const role = await roleRepository.create({
      name: args.name,
      description: args.description,
      otpAllowed: args.otpAllowed ?? false,
      permissions: args.permissions ?? [],
      companyId: currentUser.companyId,
    });
    return normalizeRole(role as unknown as Record<string, unknown>);
  },

  async updateRole(
    ctx: AppContext,
    args: { id: string; name: string; description?: string | null; otpAllowed?: boolean | null; permissions?: PermissionInput[] | null },
  ) {
    requireAuth(ctx);
    const currentUser = await userRepository.findCurrentUser(ctx.userId!);
    if (!currentUser) {
      throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
    }

    const role = await roleRepository.findByIdAndCompany(args.id, currentUser.companyId);
    if (!role) {
      throw new GraphQLError("Role not found", { extensions: { code: "NOT_FOUND" } });
    }

    if (args.name !== role.name) {
      const existing = await roleRepository.findByName(currentUser.companyId, args.name);
      if (existing) {
        throw new GraphQLError("A role with that name already exists", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
    }

    const updated = await roleRepository.update(args.id, {
      name: args.name,
      description: args.description,
      otpAllowed: args.otpAllowed ?? false,
      permissions: args.permissions ?? [],
    });
    return normalizeRole(updated as unknown as Record<string, unknown>);
  },

  async deleteRole(ctx: AppContext, id: string) {
    requireAuth(ctx);
    const currentUser = await userRepository.findCurrentUser(ctx.userId!);
    if (!currentUser) {
      throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
    }

    const role = await roleRepository.findByIdAndCompany(id, currentUser.companyId);
    if (!role) {
      throw new GraphQLError("Role not found", { extensions: { code: "NOT_FOUND" } });
    }

    await roleRepository.delete(id);
    return true;
  },
};
