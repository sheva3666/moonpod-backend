import type { AppContext } from "../../../context.js";
import { userService } from "../../../services/userService/index.js";
import type { CreateTeamMemberInput, UpdateTeamMemberInput } from "../../../services/userService/types.js";

export const teamMemberMutations = {
  createTeamMember: (_: unknown, { input }: { input: CreateTeamMemberInput }, ctx: AppContext) =>
    userService.createTeamMember(ctx, input),

  updateTeamMember: (_: unknown, { id, input }: { id: string; input: UpdateTeamMemberInput }, ctx: AppContext) =>
    userService.updateTeamMember(ctx, id, input),

  deleteTeamMember: (_: unknown, { id }: { id: string }, ctx: AppContext) =>
    userService.deleteTeamMember(ctx, id),
};
