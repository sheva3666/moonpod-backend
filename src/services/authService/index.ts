import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry, verifyRefreshToken } from "../../auth/jwt.js";
import type { AppContext } from "../../context.js";
import type { AuthPayloadResult } from "../../types.js";
import { registerSchema } from "../../schemas/validation.js";
import { auditService } from "../auditService.js";
import { userRepository } from "../../repositories/userRepository/index.js";
import { companyRepository } from "../../repositories/companyRepository/index.js";
import { authRepository } from "../../repositories/authRepository/index.js";

const SALT_ROUNDS = 12;

export type RegisterArgs = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  pin: string;
};

export type LoginArgs = {
  email: string;
  password: string;
};

export const authService = {
  async register(_ctx: AppContext, args: RegisterArgs): Promise<AuthPayloadResult> {
    const result = registerSchema.safeParse(args);
    if (!result.success) {
      throw new GraphQLError(result.error.issues[0]?.message ?? "Invalid input", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const { companyName, companyAddress, companyPhone, firstName, lastName, email, password, pin } = result.data;

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new GraphQLError("Email already in use", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const [hashedPassword, hashedPin] = await Promise.all([
      bcrypt.hash(password, SALT_ROUNDS),
      bcrypt.hash(pin, SALT_ROUNDS),
    ]);

    const company = await companyRepository.create({ name: companyName, address: companyAddress, phone: companyPhone });
    const user = await userRepository.create({ firstName, lastName, email, password: hashedPassword, pin: hashedPin, accountType: "OWNER", companyId: company.id });

    const tokenPayload = { userId: user.id };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await authRepository.createRefreshToken({ token: refreshToken, userId: user.id, expiresAt: getRefreshTokenExpiry() });

    auditService.log({ action: "REGISTER", userId: user.id, success: true });

    return { accessToken, refreshToken, user };
  },

  async login(_ctx: AppContext, { email, password }: LoginArgs): Promise<AuthPayloadResult> {
    const user = await userRepository.findByEmailWithCompany(email);

    if (!user) {
      auditService.log({ action: "LOGIN_FAILED", success: false, details: { reason: "user_not_found" } });
      throw new GraphQLError("Invalid credentials", { extensions: { code: "INVALID_CREDENTIALS" } });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      auditService.log({ action: "LOGIN_FAILED", userId: user.id, success: false, details: { reason: "wrong_password" } });
      throw new GraphQLError("Invalid credentials", { extensions: { code: "INVALID_CREDENTIALS" } });
    }

    const tokenPayload = { userId: user.id };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await authRepository.createRefreshToken({ token: refreshToken, userId: user.id, expiresAt: getRefreshTokenExpiry() });

    auditService.log({ action: "LOGIN_SUCCESS", userId: user.id, success: true });

    return { accessToken, refreshToken, user };
  },

  async refreshToken(_ctx: AppContext, { refreshToken }: { refreshToken: string }): Promise<{ accessToken: string; refreshToken: string }> {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      const suspicious = await authRepository.findRefreshToken(refreshToken);
      if (suspicious) {
        await authRepository.revokeAllRefreshTokens(suspicious.userId);
        auditService.log({ action: "REFRESH_TOKEN_REUSE_DETECTED", userId: suspicious.userId, success: false });
      }
      throw new GraphQLError("Invalid or expired refresh token", { extensions: { code: "INVALID_TOKEN" } });
    }

    const stored = await authRepository.findRefreshToken(refreshToken);
    if (!stored || stored.expiresAt < new Date()) {
      throw new GraphQLError("Refresh token not found or expired", { extensions: { code: "INVALID_TOKEN" } });
    }

    const tokenPayload = { userId: decoded.userId };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    await authRepository.rotateRefreshToken(refreshToken, newRefreshToken, decoded.userId, getRefreshTokenExpiry());

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(_ctx: AppContext, { refreshToken }: { refreshToken: string }): Promise<boolean> {
    await authRepository.revokeRefreshToken(refreshToken);
    return true;
  },
};
