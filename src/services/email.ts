import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

export async function sendMagicLinkEmail(to: string, magicLinkUrl: string): Promise<void> {
  const mailOptions = {
    from: env.SMTP_FROM,
    to,
    subject: "Your Moonpod magic link",
    text: `Click the link below to sign in to Moonpod. This link expires in 15 minutes and can only be used once.\n\n${magicLinkUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#1a1a1a">Sign in to Moonpod</h2>
        <p style="color:#555">Click the button below to sign in. This link expires in <strong>15 minutes</strong> and can only be used once.</p>
        <a href="${magicLinkUrl}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#7C3AED;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">Sign in to Moonpod</a>
        <p style="color:#999;font-size:13px">If the button doesn't work, copy and paste this link:<br>${magicLinkUrl}</p>
        <p style="color:#bbb;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };

  if (transporter) {
    await transporter.sendMail(mailOptions);
  } else {
    console.log("\n--- [DEV EMAIL] ---");
    console.log("To:", to);
    console.log("Subject:", mailOptions.subject);
    console.log("Text:", mailOptions.text);
    console.log("-------------------\n");
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const mailOptions = {
    from: env.SMTP_FROM,
    to,
    subject: "Reset your Moonpod password",
    text: `You requested a password reset for your Moonpod account. Click the link below to set a new password. This link expires in 15 minutes and can only be used once.\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#1a1a1a">Reset your Moonpod password</h2>
        <p style="color:#555">Click the button below to set a new password. This link expires in <strong>15 minutes</strong> and can only be used once.</p>
        <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#7C3AED;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">Reset Password</a>
        <p style="color:#999;font-size:13px">If the button doesn't work, copy and paste this link:<br>${resetUrl}</p>
        <p style="color:#bbb;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };

  if (transporter) {
    await transporter.sendMail(mailOptions);
  } else {
    console.log("\n--- [DEV EMAIL] ---");
    console.log("To:", to);
    console.log("Subject:", mailOptions.subject);
    console.log("Text:", mailOptions.text);
    console.log("-------------------\n");
  }
}
