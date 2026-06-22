import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  let sessionOk = false;
  let dbOk = false;
  let sessionError = "";

  try {
    await getServerSession(authOptions);
    sessionOk = true;
  } catch (e: any) {
    sessionError = e?.message ?? "Unbekannter Fehler";
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return NextResponse.json({
    origin,
    nextauth_url: process.env.NEXTAUTH_URL ?? "NICHT GESETZT",
    vercel_url: process.env.VERCEL_URL ?? "NICHT GESETZT",
    spotify_client_id: process.env.SPOTIFY_CLIENT_ID
      ? process.env.SPOTIFY_CLIENT_ID.slice(0, 6) + "..."
      : "FEHLT",
    nextauth_secret: process.env.NEXTAUTH_SECRET ? "OK" : "FEHLT",
    database_url: process.env.DATABASE_URL ? "OK" : "FEHLT",
    session_ok: sessionOk,
    session_error: sessionError,
    db_ok: dbOk,
    signin_url: `${origin}/api/auth/signin/spotify`,
    expected_callback: `${origin}/api/auth/callback/spotify`,
  });
}
