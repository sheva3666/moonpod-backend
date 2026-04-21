import type { AppContext } from "../../../context.js";
import { passwordResetService } from "../../../services/passwordResetService/index.js";

export const passwordResetMutations = {
  requestPasswordReset: (_: unknown, args: { email: string }, ctx: AppContext) =>
    passwordResetService.requestPasswordReset(ctx, args),

  resetPassword: (_: unknown, args: { token: string; newPassword: string }, ctx: AppContext) =>
    passwordResetService.resetPassword(ctx, args),
};
