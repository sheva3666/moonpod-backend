import type { AppContext } from "../../../context.js";
import { roleService, type RolesArgs } from "../../../services/roleService/index.js";

export const roleQueries = {
  roles: (_: unknown, args: RolesArgs, ctx: AppContext) =>
    roleService.getRoles(ctx, args),
  role: (_: unknown, args: { id: string }, ctx: AppContext) =>
    roleService.getRole(ctx, args.id),
};
