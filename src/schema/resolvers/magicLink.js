import crypto from "crypto";
import { GraphQLError } from "graphql";
import { generateAccessToken, generateRefreshToken } from "../../auth/jwt.js";
import { sendMagicLinkEmail } from "../../services/email.js";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function refreshTokenExpiryDate() {
  const days = parseInt(process.env.JWT_REFRESH_EXPIRES_IN) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export const magicLinkMutations = {
  async sendMagicLink(_, { email }, { prisma }) {
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return true — don't reveal whether the email exists
    if (!user) return true;

    // Invalidate any existing unused tokens for this user
    await prisma.magicLinkToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await prisma.magicLinkToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const appUrl = process.env.APP_URL || "http://localhost:5173";
    const magicLinkUrl = `${appUrl}/auth/magic-link/verify?token=${token}`;

    await sendMagicLinkEmail(email, magicLinkUrl);

    return true;
  },

  async verifyMagicLink(_, { token }, { prisma }) {
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
};
