import { authMutations } from "./auth.js";
import { magicLinkMutations } from "./magicLink.js";
import { passwordResetMutations } from "./passwordReset.js";
import { userQueries } from "./user.js";

export const resolvers = {
  Query: {
    ...userQueries,
  },
  Mutation: {
    ...authMutations,
    ...magicLinkMutations,
    ...passwordResetMutations,
  },
};
