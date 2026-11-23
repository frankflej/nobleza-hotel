import nodemailer from "nodemailer";
import { env } from "@NOBLEZA/env/server";

export async function sendHotelEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    return false;
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: `"Nobleza Hotel" <${env.SMTP_USER}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  return true;
}
