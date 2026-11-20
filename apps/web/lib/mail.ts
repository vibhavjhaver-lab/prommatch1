import nodemailer from "nodemailer";
import { render } from "@react-email/components";
import * as React from "react";
import { SignInCode } from "@prommatch/emails";
import { getEnv } from "./env.js";

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(getEnv().SMTP_URL);
  }
  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }) {
  const env = getEnv();
  await getTransporter().sendMail({
    from: env.EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

export async function sendVerificationEmail(opts: { to: string; url: string; code: string; appName: string }) {
  const html = await render(
    React.createElement(SignInCode, {
      appName: opts.appName,
      code: opts.code,
      magicLink: opts.url,
      expiresInMinutes: 15,
    }),
  );
  await sendMail({ to: opts.to, subject: `Your ${opts.appName} sign-in code: ${opts.code}`, html });
}
