import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth.js";
import { getEnv } from "../../../lib/env.js";

/**
 * Issues a short-lived JWT the client attaches when connecting to
 * apps/realtime's Socket.IO server (socket.handshake.auth.token). The
 * realtime server verifies this with the same REALTIME_JWT_SECRET (HS256)
 * and trusts the embedded userId/role for room access (spec section 11) —
 * it never touches the session cookie or the database to re-derive identity.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const env = getEnv();
  const secret = new TextEncoder().encode(env.REALTIME_JWT_SECRET);

  const token = await new SignJWT({ userId: session.user.id, role: session.user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);

  return NextResponse.json({ token, realtimeUrl: env.REALTIME_URL });
}
