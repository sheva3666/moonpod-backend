import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../auth/jwt.js";

const SALT_ROUNDS = 12;

function refreshTokenExpiryDate() {
  const days = parseInt(process.env.JWT_REFRESH_EXPIRES_IN) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export const authMutations = {
  async register(_, { companyName, companyAddress, companyPhone, firstName, lastName, email, password, pin }, { prisma }) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new GraphQLError("Email already in use", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const hashedPin = await bcrypt.hash(pin, SALT_ROUNDS);

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

    const payload = { userId: user.id };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshTokenExpiryDate(),
      },
    });

    return { accessToken, refreshToken, user };
  },

  async login(_, { email, password }, { prisma }) {
    const user = await prisma.user.findUnique({ where: { email } });
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

    const payload = { userId: user.id };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshTokenExpiryDate(),
      },
    });

    return { accessToken, refreshToken, user };
  },

  async refreshToken(_, { refreshToken }, { prisma }) {
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
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new GraphQLError("Refresh token not found or expired", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    // Rotate the refresh token
    await prisma.refreshToken.delete({ where: { token: refreshToken } });

    const payload = { userId: decoded.userId };
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: decoded.userId,
        expiresAt: refreshTokenExpiryDate(),
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(_, { refreshToken }, { prisma }) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return true;
  },
};
