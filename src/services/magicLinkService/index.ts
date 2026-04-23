import { randomBytes } from "node:crypto";
import { GraphQLError } from "graphql";
import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from "../../auth/jwt.js";
import { sendMagicLinkEmail } from "../email.js";
import { env } from "../../config/env.js";
import type { AppContext } from "../../context.js";
import type { AuthPayloadResult } from "../../types.js";
import { userRepository } from "../../repositories/userRepository/index.js";
import { magicLinkRepository } from "../../repositories/magicLinkRepository/index.js";
import { authRepository } from "../../repositories/authRepository/index.js";

const TOKEN_TTL_MS = 15 * 60 * 1000;

export const magicLinkService = {
  async sendMagicLink(_ctx: AppContext, { email }: { email: string }): Promise<boolean> {
    const user = await userRepository.findByEmail(email);

    // Always return true — don't reveal whether the email exists
    if (!user) return true;

    const recentToken = await magicLinkRepository.findRecentUnused(user.id);
    if (recentToken) return true;

    await magicLinkRepository.invalidateAll(user.id);

    const token = randomBytes(32).toString("hex");
    await magicLinkRepository.create({ token, userId: user.id, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) });

    await sendMagicLinkEmail(email, `${env.APP_URL}/auth/magic-link/verify?token=${token}`);

    return true;
  },

  async verifyMagicLink(_ctx: AppContext, { token }: { token: string }): Promise<AuthPayloadResult> {
    const record = await magicLinkRepository.findByToken(token);

    if (!record || record.used || record.expiresAt < new Date()) {
      throw new GraphQLError("Magic link is invalid or has expired", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    await magicLinkRepository.markUsed(record.id);

    const { user } = record;
    const tokenPayload = { userId: user.id };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await authRepository.createRefreshToken({ token: refreshToken, userId: user.id, expiresAt: getRefreshTokenExpiry() });

    return { accessToken, refreshToken, user };
  },
};
