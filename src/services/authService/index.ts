import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  verifyRefreshToken,
} from "../../auth/jwt.js";
import type { AppContext } from "../../context.js";
import type { AuthPayloadResult } from "../../types.js";
import { registerSchema } from "../../schemas/validation.js";
import { auditService } from "../auditService.js";

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
  // M4: validate all registration inputs with Zod before touching the DB
  async register(
    { prisma }: AppContext,
    args: RegisterArgs,
  ): Promise<AuthPayloadResult> {
    const result = registerSchema.safeParse(args);
    if (!result.success) {
      throw new GraphQLError(result.error.issues[0]?.message ?? "Invalid input", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const { companyName, companyAddress, companyPhone, firstName, lastName, email, password, pin } = result.data;

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new GraphQLError("Email already in use", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const [hashedPassword, hashedPin] = await Promise.all([
      bcrypt.hash(password, SALT_ROUNDS),
      bcrypt.hash(pin, SALT_ROUNDS),
    ]);

    const company = await prisma.company.create({
      data: { name: companyName, address: companyAddress, phone: companyPhone },
    });

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        pin: hashedPin,
        accountType: "OWNER",
        companyId: company.id,
      },
      include: { company: true },
    });

    const tokenPayload = { userId: user.id };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: getRefreshTokenExpiry() },
    });

    auditService.log({ action: "REGISTER", userId: user.id, success: true });

    return { accessToken, refreshToken, user };
  },

  async login(
    { prisma }: AppContext,
    { email, password }: LoginArgs,
  ): Promise<AuthPayloadResult> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    // L4: use INVALID_CREDENTIALS — distinct from UNAUTHENTICATED (no token provided)
    if (!user) {
      auditService.log({ action: "LOGIN_FAILED", success: false, details: { reason: "user_not_found" } });
      throw new GraphQLError("Invalid credentials", {
        extensions: { code: "INVALID_CREDENTIALS" },
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      auditService.log({ action: "LOGIN_FAILED", userId: user.id, success: false, details: { reason: "wrong_password" } });
      throw new GraphQLError("Invalid credentials", {
        extensions: { code: "INVALID_CREDENTIALS" },
      });
    }

    const tokenPayload = { userId: user.id };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: getRefreshTokenExpiry() },
    });

    auditService.log({ action: "LOGIN_SUCCESS", userId: user.id, success: true });

    return { accessToken, refreshToken, user };
  },

  // H3: atomic token rotation in a transaction; detect suspicious reuse on JWT failure
  async refreshToken(
    { prisma }: AppContext,
    { refreshToken }: { refreshToken: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      // JWT invalid — if the raw token still exists in the DB something is very wrong
      const suspicious = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
      if (suspicious) {
        await prisma.refreshToken.deleteMany({ where: { userId: suspicious.userId } });
        auditService.log({ action: "REFRESH_TOKEN_REUSE_DETECTED", userId: suspicious.userId, success: false });
      }
      throw new GraphQLError("Invalid or expired refresh token", {
        extensions: { code: "INVALID_TOKEN" },
      });
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      select: { expiresAt: true, userId: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new GraphQLError("Refresh token not found or expired", {
        extensions: { code: "INVALID_TOKEN" },
      });
    }

    const tokenPayload = { userId: decoded.userId };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { token: refreshToken } }),
      prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: decoded.userId,
          expiresAt: getRefreshTokenExpiry(),
        },
      }),
    ]);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(
    { prisma }: AppContext,
    { refreshToken }: { refreshToken: string },
  ): Promise<boolean> {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return true;
  },
};
