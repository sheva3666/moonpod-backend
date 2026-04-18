import { GraphQLError } from "graphql";
import type { AppContext } from "../../context.js";
import type { UserWithCompany } from "../../types.js";

const MAX_PAGE_SIZE = 100;

export const userQueries = {
  async me(
    _: unknown,
    __: Record<string, never>,
    { prisma, userId }: AppContext,
  ): Promise<UserWithCompany> {
    if (!userId) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });
    if (!user) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    return user;
  },

  async users(
    _: unknown,
    __: Record<string, never>,
    { prisma, userId }: AppContext,
  ): Promise<UserWithCompany[]> {
    if (!userId) {
      throw new GraphQLError("Not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    return prisma.user.findMany({
      include: { company: true },
      orderBy: { createdAt: "desc" },
      take: MAX_PAGE_SIZE,
    });
  },
};
