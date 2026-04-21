import type { AppContext } from "../../../context.js";
import { authService, type RegisterArgs, type LoginArgs } from "../../../services/authService/index.js";

export const authMutations = {
  register: (_: unknown, args: RegisterArgs, ctx: AppContext) =>
    authService.register(ctx, args),

  login: (_: unknown, args: LoginArgs, ctx: AppContext) =>
    authService.login(ctx, args),

  refreshToken: (_: unknown, args: { refreshToken: string }, ctx: AppContext) =>
    authService.refreshToken(ctx, args),

  logout: (_: unknown, args: { refreshToken: string }, ctx: AppContext) =>
    authService.logout(ctx, args),
};
