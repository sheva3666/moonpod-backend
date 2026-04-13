import { authMutations } from "./auth.js";
import { userQueries } from "./user.js";

export const resolvers = {
  Query: {
    ...userQueries,
  },
  Mutation: {
    ...authMutations,
  },
};
