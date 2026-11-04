// server/services/emailService.js

import nodemailer from "nodemailer";

let transporter = null;

function getEmailMode() {
  const configured = String(process.env.EMAIL_MODE || "").trim().toLowerCase();
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? "smtp" : "console";
}

function getSmtpConfig() {
  const port = Number.parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  return {
    host: process.env.SMTP_HOST || "",
    port: Number.isFinite(port) ? port : 587,
    secure,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || "",
        }
      : undefined,
  };
}

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport(getSmtpConfig());
  return transporter;
}

export function validateEmailConfiguration() {
  const mode = getEmailMode();

  if (mode !== "console" && mode !== "smtp") {
    throw new Error('EMAIL_MODE must be either "console" or "smtp".');
  }

  if (mode === "smtp" && !process.env.SMTP_HOST) {
    throw new Error("SMTP_HOST must be set when EMAIL_MODE=smtp.");
  }

  if (mode === "smtp" && !process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM must be set when EMAIL_MODE=smtp.");
  }
}

async function sendEmail({ to, subject, text, html }) {
  const mode = getEmailMode();

  if (mode === "console") {
    console.log("\n--- UCalgaryGuessr email (console mode) ---");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log("--- end email ---\n");
    return;
  }

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });
}

export async function sendMagicLoginEmail({ to, loginUrl }) {
  await sendEmail({
    to,
    subject: "Your UCalgaryGuessr login link",
    text: `Use this single-use link to log in to UCalgaryGuessr:\n\n${loginUrl}\n\nThis link expires shortly. If you did not request it, you can ignore this email.`,
    html: `<p>Use this single-use link to log in to UCalgaryGuessr:</p><p><a href="${loginUrl}">Log in to UCalgaryGuessr</a></p><p>This link expires shortly. If you did not request it, you can ignore this email.</p>`,
  });
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  await sendEmail({
    to,
    subject: "Reset your UCalgaryGuessr password",
    text: `Use this single-use link to reset your UCalgaryGuessr password:\n\n${resetUrl}\n\nThis link expires shortly. If you did not request it, you can ignore this email.`,
    html: `<p>Use this single-use link to reset your UCalgaryGuessr password:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires shortly. If you did not request it, you can ignore this email.</p>`,
  });
}
