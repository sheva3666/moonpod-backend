import { authMutations } from "./mutations/auth.js";
import { magicLinkMutations } from "./mutations/magicLink.js";
import { passwordResetMutations } from "./mutations/passwordReset.js";
import { teamMemberMutations } from "./mutations/teamMember.js";
import { roleMutations } from "./mutations/role.js";
import { userQueries } from "./queries/user.js";
import { roleQueries } from "./queries/role.js";

export const resolvers = {
  Query: {
    ...userQueries,
    ...roleQueries,
  },
  Mutation: {
    ...authMutations,
    ...magicLinkMutations,
    ...passwordResetMutations,
    ...teamMemberMutations,
    ...roleMutations,
  },
  User: {
    // Prisma returns UserRole[] via the join table; map to Role[] for GraphQL.
    roles: (parent: { roles?: { role: unknown }[] }) =>
      parent.roles?.map((ur) => ur.role) ?? [],
  },
};
