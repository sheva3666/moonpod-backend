import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { sendPasswordResetEmail } from "../email.js";
import { env } from "../../config/env.js";
import type { AppContext } from "../../context.js";
import { passwordSchema } from "../../schemas/validation.js";
import { auditService } from "../auditService.js";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const SALT_ROUNDS = 12;

export const passwordResetService = {
  async requestPasswordReset(
    { prisma }: AppContext,
    { email }: { email: string },
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
    { prisma }: AppContext,
    { token, newPassword }: { token: string; newPassword: string },
  ): Promise<boolean> {
    // C2: validate password strength before touching the DB
    const passwordResult = passwordSchema.safeParse(newPassword);
    if (!passwordResult.success) {
      throw new GraphQLError(passwordResult.error.issues[0]?.message ?? "Invalid password", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: { id: true, userId: true, used: true, expiresAt: true },
    });

    if (!record || record.used || record.expiresAt < new Date()) {
      throw new GraphQLError("Reset link is invalid or has expired", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const hashedPassword = await bcrypt.hash(passwordResult.data, SALT_ROUNDS);

    // C1: invalidate ALL unused reset tokens for this user, not just the current one
    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { used: true },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, used: false },
        data: { used: true },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword },
      }),
      // Revoke all sessions so old sessions cannot be reused after a password change
      prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    auditService.log({ action: "PASSWORD_RESET", userId: record.userId, success: true });

    return true;
  },
};
