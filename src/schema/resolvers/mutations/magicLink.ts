import type { AppContext } from "../../../context.js";
import { magicLinkService } from "../../../services/magicLinkService/index.js";

export const magicLinkMutations = {
  sendMagicLink: (_: unknown, args: { email: string }, ctx: AppContext) =>
    magicLinkService.sendMagicLink(ctx, args),

  verifyMagicLink: (_: unknown, args: { token: string }, ctx: AppContext) =>
    magicLinkService.verifyMagicLink(ctx, args),
};
