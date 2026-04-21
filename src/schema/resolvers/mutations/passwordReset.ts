import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { sendPasswordResetEmail } from "../../../services/email.js";
import { env } from "../../../config/env.js";
import type { AppContext } from "../../../context.js";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const SALT_ROUNDS = 12;

export const passwordResetMutations = {
  async requestPasswordReset(
    _: unknown,
    { email }: { email: string },
    { prisma }: AppContext,
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    // Always return true — don't reveal whether the email exists
    if (!user) return true;

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const resetUrl = `${env.APP_URL}/auth/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl);

    return true;
  },

  async resetPassword(
    _: unknown,
    { token, newPassword }: { token: string; newPassword: string },
    { prisma }: AppContext,
  ): Promise<boolean> {
    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: { id: true, userId: true, used: true, expiresAt: true },
    });

    if (!record || record.used || record.expiresAt < new Date()) {
      throw new GraphQLError("Reset link is invalid or has expired", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { used: true },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword },
      }),
      // Invalidate all existing refresh tokens so old sessions are revoked
      prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    return true;
  },
};
