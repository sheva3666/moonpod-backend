import { GraphQLError } from "graphql";

export const userQueries = {
  async me(_, __, { prisma, userId }) {
    if (!userId) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    return user;
  },

  async users(_, __, { prisma, userId }) {
    if (!userId) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    return prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  },
};
