import type { AppContext } from "../../../context.js";
import { roleService } from "../../../services/roleService/index.js";

export const roleMutations = {
  createRole: (
    _: unknown,
    args: { name: string; description?: string | null; otpAllowed?: boolean | null; permissions?: { module: string; canRead: boolean; canEdit: boolean; canDelete: boolean }[] | null },
    ctx: AppContext,
  ) => roleService.createRole(ctx, args),

  updateRole: (
    _: unknown,
    args: { id: string; name: string; description?: string | null; otpAllowed?: boolean | null; permissions?: { module: string; canRead: boolean; canEdit: boolean; canDelete: boolean }[] | null },
    ctx: AppContext,
  ) => roleService.updateRole(ctx, args),

  deleteRole: (_: unknown, args: { id: string }, ctx: AppContext) =>
    roleService.deleteRole(ctx, args.id),
};
