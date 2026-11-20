import webpush from "web-push";
import { prisma } from "@prommatch/db";
import { getEnv } from "../env.js";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const env = getEnv();
  webpush.setVapidDetails(`mailto:${env.VAPID_CONTACT_EMAIL}`, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
}

/**
 * Sends a Web Push notification to every subscription the user has
 * registered (they may have several — one per device/browser). A
 * subscription that the push service reports as gone (410/404) is
 * deleted so it stops being retried on every future notification.
 */
export async function sendPushToUser(userId: string, payload: { title: string; body: string; link?: string }) {
  ensureConfigured();
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
          JSON.stringify(payload),
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        } else {
          // eslint-disable-next-line no-console
          console.error(`push failed for subscription ${sub.id}:`, err);
        }
      }
    }),
  );
}
