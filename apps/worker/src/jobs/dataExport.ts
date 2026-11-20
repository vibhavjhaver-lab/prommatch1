import { randomUUID } from "node:crypto";
import archiver from "archiver";
import type { Job } from "bullmq";
import type { JobPayloads } from "@prommatch/core";
import { prisma } from "@prommatch/db";
import { uploadExportAndSign } from "../lib/storage.js";
import { sendMail } from "../lib/mail.js";

/**
 * Handles both me.requestDataExport (a student downloading their own
 * data, spec section 9's privacy rights) and admin.data.exportFull (a
 * superadmin's full event export) through the same job — the two share a
 * payload shape ({ userId }), so this job tells them apart by that user's
 * role rather than needing a second job name.
 */
export async function processDataExport(job: Job<JobPayloads["data.export"]>) {
  const { userId } = job.data;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const files =
    user.role === "STUDENT" ? await buildPersonalExportFiles(userId) : await buildFullEventExportFiles();

  const zipBuffer = await zipFiles(files);
  const key = `exports/${userId}/${randomUUID()}.zip`;
  const signedUrl = await uploadExportAndSign(key, zipBuffer);

  await sendMail({
    to: user.email,
    subject: user.role === "STUDENT" ? "Your PromMatch data export" : "PromMatch full event export",
    html: `<p>Your export is ready. This link expires in 24 hours:</p><p><a href="${signedUrl}">${signedUrl}</a></p>`,
  });

  await prisma.auditLog.create({
    data: { actorId: userId, action: "data.export_delivered", targetType: "User", targetId: userId, meta: { scope: user.role === "STUDENT" ? "personal" : "full_event" } },
  });
}

async function buildPersonalExportFiles(userId: string): Promise<Record<string, string>> {
  const [profile, prefs, answers, photos, sentMessages, matches, promposals, reports] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.matchPreferences.findUnique({ where: { userId } }),
    prisma.answer.findMany({ where: { userId } }),
    prisma.photo.findMany({ where: { userId } }),
    prisma.message.findMany({ where: { senderId: userId } }),
    prisma.match.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
    prisma.promposal.findMany({ where: { fromId: userId } }),
    prisma.report.findMany({ where: { reporterId: userId } }),
  ]);

  return {
    "profile.json": JSON.stringify(profile, null, 2),
    "preferences.json": JSON.stringify(prefs, null, 2),
    "questionnaire-answers.json": JSON.stringify(answers, null, 2),
    "photos.json": JSON.stringify(photos.map((p) => ({ id: p.id, status: p.status, order: p.order })), null, 2),
    "sent-messages.json": JSON.stringify(sentMessages, null, 2),
    "matches.json": JSON.stringify(matches, null, 2),
    "promposals-sent.json": JSON.stringify(promposals, null, 2),
    "reports-filed.json": JSON.stringify(reports, null, 2),
    "README.txt":
      "This export contains the personal data PromMatch holds about you, per our privacy notice. " +
      "It does not include other students' private answers or preferences, or anyone else's messages in your conversations.",
  };
}

async function buildFullEventExportFiles(): Promise<Record<string, string>> {
  const [users, rounds, matches, squads, reports, auditLog] = await Promise.all([
    prisma.user.findMany({ select: { id: true, email: true, role: true, status: true, createdAt: true } }),
    prisma.matchRound.findMany(),
    prisma.match.findMany(),
    prisma.squad.findMany({ include: { members: true } }),
    prisma.report.findMany(),
    prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return {
    "users.json": JSON.stringify(users, null, 2),
    "rounds.json": JSON.stringify(rounds, null, 2),
    "matches.json": JSON.stringify(matches, null, 2),
    "squads.json": JSON.stringify(squads, null, 2),
    "reports.json": JSON.stringify(reports, null, 2),
    "audit-log.json": JSON.stringify(auditLog, null, 2),
    "README.txt": "Full event export — superadmin only. Contains identifying data; handle per your institution's data policy.",
  };
}

function zipFiles(files: Record<string, string>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip");
    const chunks: Buffer[] = [];
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    for (const [name, content] of Object.entries(files)) {
      archive.append(content, { name });
    }
    void archive.finalize();
  });
}
