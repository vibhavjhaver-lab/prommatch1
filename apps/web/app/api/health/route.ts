import { NextResponse } from "next/server";
import { prisma } from "@prommatch/db";

/** Liveness/readiness probe for the hosting platform (Render/Fly/Railway). */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, service: "web", time: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, service: "web", error: err instanceof Error ? err.message : "unknown" },
      { status: 503 },
    );
  }
}
