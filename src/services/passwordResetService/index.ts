import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { sendPasswordResetEmail } from "../email.js";
import { env } from "../../config/env.js";
import type { AppContext } from "../../context.js";
import { passwordSchema } from "../../schemas/validation.js";
import { auditService } from "../auditService.js";
import { userRepository } from "../../repositories/userRepository/index.js";
import { passwordResetRepository } from "../../repositories/passwordResetRepository/index.js";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const SALT_ROUNDS = 12;

export const passwordResetService = {
  async requestPasswordReset(_ctx: AppContext, { email }: { email: string }): Promise<boolean> {
    const user = await userRepository.findByEmail(email);

    // Always return true — don't reveal whether the email exists
    if (!user) return true;

    await passwordResetRepository.invalidateAll(user.id);

    const token = randomBytes(32).toString("hex");
    await passwordResetRepository.create({ token, userId: user.id, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) });

    await sendPasswordResetEmail(email, `${env.APP_URL}/auth/reset-password?token=${token}`);

    return true;
  },

  async resetPassword(_ctx: AppContext, { token, newPassword }: { token: string; newPassword: string }): Promise<boolean> {
    const passwordResult = passwordSchema.safeParse(newPassword);
    if (!passwordResult.success) {
      throw new GraphQLError(passwordResult.error.issues[0]?.message ?? "Invalid password", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const record = await passwordResetRepository.findByToken(token);
    if (!record || record.used || record.expiresAt < new Date()) {
      throw new GraphQLError("Reset link is invalid or has expired", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const hashedPassword = await bcrypt.hash(passwordResult.data, SALT_ROUNDS);

    await passwordResetRepository.performReset(record.id, record.userId, hashedPassword);

    auditService.log({ action: "PASSWORD_RESET", userId: record.userId, success: true });

    return true;
  },
};
