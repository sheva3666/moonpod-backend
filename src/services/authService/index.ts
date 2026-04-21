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
  async register(
    { prisma }: AppContext,
    { companyName, companyAddress, companyPhone, firstName, lastName, email, password, pin }: RegisterArgs,
  ): Promise<AuthPayloadResult> {
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
    if (!user) {
      throw new GraphQLError("Invalid credentials", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new GraphQLError("Invalid credentials", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const tokenPayload = { userId: user.id };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: getRefreshTokenExpiry() },
    });

    return { accessToken, refreshToken, user };
  },

  async refreshToken(
    { prisma }: AppContext,
    { refreshToken }: { refreshToken: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new GraphQLError("Invalid or expired refresh token", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      select: { expiresAt: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new GraphQLError("Refresh token not found or expired", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    await prisma.refreshToken.delete({ where: { token: refreshToken } });

    const tokenPayload = { userId: decoded.userId };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: decoded.userId,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

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
