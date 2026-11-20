import { prisma } from "@prommatch/db";
import { sendMail } from "../lib/mail.js";

const DIGEST_INTERVAL_HOURS = 24;

/**
 * A daily-ish operational summary emailed to every organizer/superadmin —
 * open reports and pending photo reviews are the two queues that
 * actually need a human, so those are what's surfaced. Gated by actually
 * checking the last digest's timestamp in AuditLog rather than assuming
 * the cron schedule is exactly 24h, since cron.tick can fire more often.
 */
export async function processDigestOrganizers() {
  const lastDigest = await prisma.auditLog.findFirst({
    where: { action: "digest.organizers_sent" },
    orderBy: { createdAt: "desc" },
  });
  if (lastDigest && Date.now() - lastDigest.createdAt.getTime() < DIGEST_INTERVAL_HOURS * 60 * 60 * 1000) {
    return { sent: false, reason: "too_soon" as const };
  }

  const [openReports, pendingPhotos, organizers] = await Promise.all([
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.photo.count({ where: { status: "PENDING" } }),
    prisma.user.findMany({ where: { role: { in: ["ORGANIZER", "SUPERADMIN"] } }, select: { email: true } }),
  ]);

  const html = `
    <p>Daily PromMatch summary:</p>
    <ul>
      <li>${openReports} open report${openReports === 1 ? "" : "s"}</li>
      <li>${pendingPhotos} photo${pendingPhotos === 1 ? "" : "s"} waiting on review</li>
    </ul>
  `;

  await Promise.all(organizers.map((o) => sendMail({ to: o.email, subject: "PromMatch daily summary", html })));
  await prisma.auditLog.create({ data: { actorId: null, action: "digest.organizers_sent", targetType: "Event", meta: { openReports, pendingPhotos } } });

  return { sent: true, recipients: organizers.length, openReports, pendingPhotos };
}
