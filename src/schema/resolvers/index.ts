import { authMutations } from "./mutations/auth.js";
import { magicLinkMutations } from "./mutations/magicLink.js";
import { passwordResetMutations } from "./mutations/passwordReset.js";
import { userQueries } from "./queries/user.js";

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
