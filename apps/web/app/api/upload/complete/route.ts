import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@prommatch/db";
import { writeAudit } from "@prommatch/core";
import { auth } from "../../../../lib/auth.js";
import { confirmUpload, getSignedPhotoUrl } from "../../../../lib/storage.js";

const BodySchema = z.object({ rawKey: z.string().min(1) });

/**
 * Called by the client after a direct-to-S3 presigned upload finishes.
 * Downloads the raw object, strips EXIF/GPS, generates the display + thumb
 * variants, re-uploads them, deletes the raw object, and creates the Photo
 * row in PENDING status for organizer review (spec section 9).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Raw keys are namespaced per-user at presign time (uploads/<userId>/<uuid>,
  // see lib/storage.ts's getUploadUrl); reject anything that doesn't belong
  // to the caller so one student can't confirm/consume another's upload.
  if (!parsed.data.rawKey.startsWith(`uploads/${session.user.id}/`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const existingCount = await prisma.photo.count({ where: { userId: session.user.id } });
  if (existingCount >= 6) {
    return NextResponse.json({ error: "photo_limit_reached" }, { status: 409 });
  }

  const { finalKey, thumbKey } = await confirmUpload(parsed.data.rawKey);

  const photo = await prisma.photo.create({
    data: {
      userId: session.user.id,
      key: finalKey,
      thumbKey,
      status: "PENDING",
      order: existingCount,
    },
  });

  await writeAudit(prisma, {
    actorId: session.user.id,
    action: "photo.uploaded",
    targetType: "Photo",
    targetId: photo.id,
  });

  const signedUrl = await getSignedPhotoUrl(finalKey);
  return NextResponse.json({ photo, signedUrl });
}
