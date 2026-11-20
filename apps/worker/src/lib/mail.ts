import nodemailer from "nodemailer";
import { render } from "@react-email/components";
import * as React from "react";
import { MatchDrop, MutualMatch, PromposalReceived } from "@prommatch/emails";
import { getEnv } from "../env.js";

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(getEnv().SMTP_URL);
  }
  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; html: string }) {
  const env = getEnv();
  await getTransporter().sendMail({ from: env.EMAIL_FROM, to: opts.to, subject: opts.subject, html: opts.html });
}

/**
 * Renders and sends the `notify.email` job's payload. `template` and
 * `props` come straight from apps/web's lib/notify.ts, which only ever
 * sets them to one of the cases below — anything else is logged and
 * dropped rather than thrown, so a future, not-yet-handled template name
 * doesn't take down the whole job.
 */
export async function sendNotificationEmail(
  to: string,
  template: string,
  props: Record<string, unknown>,
  displayName: string,
) {
  const appName = "PromMatch";
  let html: string;
  let subject: string;
  const url = typeof props.link === "string" ? `${getEnv().APP_URL}${props.link}` : getEnv().APP_URL;

  switch (template) {
    case "MutualMatch":
      html = await render(
        React.createElement(MutualMatch, { appName, displayName, matchName: "your match", chatUrl: url }),
      );
      subject = String(props.title ?? "It's mutual!");
      break;
    case "PromposalReceived":
      html = await render(
        React.createElement(PromposalReceived, { appName, displayName, fromName: "Someone", viewUrl: url }),
      );
      subject = String(props.title ?? "You've got a promposal!");
      break;
    case "MatchDrop":
      html = await render(
        React.createElement(MatchDrop, {
          appName,
          displayName,
          proposalCount: 0,
          mode: "DATE",
          decisionDeadline: new Date().toISOString(),
          matchesUrl: url,
        }),
      );
      subject = String(props.title ?? "Your Match Drop is here");
      break;
    default:
      // eslint-disable-next-line no-console
      console.warn(`notify.email: unknown template "${template}", dropping`);
      return;
  }

  await sendMail({ to, subject, html });
}
