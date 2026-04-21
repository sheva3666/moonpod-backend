import type { AppContext } from "../../../context.js";
import { userService, type TeamMembersArgs } from "../../../services/userService/index.js";

export const userQueries = {
  checkEmail: (_: unknown, args: { email: string }, ctx: AppContext) =>
    userService.checkEmail(ctx, args),

  me: (_: unknown, __: Record<string, never>, ctx: AppContext) =>
    userService.getMe(ctx),

  users: (_: unknown, __: Record<string, never>, ctx: AppContext) =>
    userService.getUsers(ctx),

  teamMembers: (_: unknown, args: TeamMembersArgs, ctx: AppContext) =>
    userService.getTeamMembers(ctx, args),
};
