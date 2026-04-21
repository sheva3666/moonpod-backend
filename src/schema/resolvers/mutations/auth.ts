import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  verifyRefreshToken,
} from "../../../auth/jwt.js";
import type { AppContext } from "../../../context.js";
import type { AuthPayloadResult } from "../../../types.js";

const SALT_ROUNDS = 12;

type RegisterArgs = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  pin: string;
};

type LoginArgs = {
  email: string;
  password: string;
};

type RefreshTokenArgs = {
  refreshToken: string;
};

type LogoutArgs = {
  refreshToken: string;
};

export const authMutations = {
  async register(
    _: unknown,
    { companyName, companyAddress, companyPhone, firstName, lastName, email, password, pin }: RegisterArgs,
    { prisma }: AppContext,
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
    _: unknown,
    { email, password }: LoginArgs,
    { prisma }: AppContext,
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
    _: unknown,
    { refreshToken }: RefreshTokenArgs,
    { prisma }: AppContext,
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
    _: unknown,
    { refreshToken }: LogoutArgs,
    { prisma }: AppContext,
  ): Promise<boolean> {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return true;
  },
};
