import { randomBytes } from "node:crypto";
import { GraphQLError } from "graphql";
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
} from "../../auth/jwt.js";
import { sendMagicLinkEmail } from "../email.js";
import { env } from "../../config/env.js";
import type { AppContext } from "../../context.js";
import type { AuthPayloadResult } from "../../types.js";

const TOKEN_TTL_MS = 15 * 60 * 1000;

export const magicLinkService = {
  async sendMagicLink(
    { prisma }: AppContext,
    { email }: { email: string },
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    // Always return true — don't reveal whether the email exists
    if (!user) return true;

    // H5: prevent hammering — if a valid token was issued within the last 60 seconds, silently skip
    const recentToken = await prisma.magicLinkToken.findFirst({
      where: {
        userId: user.id,
        used: false,
        expiresAt: { gt: new Date(Date.now() - 60_000) },
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
    });
    if (recentToken) return true;

    await prisma.magicLinkToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await prisma.magicLinkToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const magicLinkUrl = `${env.APP_URL}/auth/magic-link/verify?token=${token}`;
    await sendMagicLinkEmail(email, magicLinkUrl);

    return true;
  },

  async verifyMagicLink(
    { prisma }: AppContext,
    { token }: { token: string },
  ): Promise<AuthPayloadResult> {
    const record = await prisma.magicLinkToken.findUnique({
      where: { token },
      include: { user: { include: { company: true } } },
    });

    if (!record || record.used || record.expiresAt < new Date()) {
      throw new GraphQLError("Magic link is invalid or has expired", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    await prisma.magicLinkToken.update({
      where: { id: record.id },
      data: { used: true },
    });

    const { user } = record;
    const tokenPayload = { userId: user.id };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: getRefreshTokenExpiry() },
    });

    return { accessToken, refreshToken, user };
  },
};
