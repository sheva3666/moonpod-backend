import nodemailer from "nodemailer";

function createTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Dev fallback: log to console instead of sending
  return {
    sendMail: async (options) => {
      console.log("\n--- [DEV EMAIL] ---");
      console.log("To:", options.to);
      console.log("Subject:", options.subject);
      console.log("Text:", options.text);
      console.log("-------------------\n");
      return { messageId: "dev-mode" };
    },
  };
}

const transporter = createTransport();

export async function sendMagicLinkEmail(to, magicLinkUrl) {
  const from = process.env.SMTP_FROM;

  await transporter.sendMail({
    from,
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
  });
}
