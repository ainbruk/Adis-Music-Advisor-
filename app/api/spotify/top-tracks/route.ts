import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTopTracks } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = (session as any).accessToken as string;
  if (!accessToken)
    return NextResponse.json({ error: "No Spotify token" }, { status: 400 });

  const timeRange = (req.nextUrl.searchParams.get("time_range") ?? "medium_term") as
    | "short_term"
    | "medium_term"
    | "long_term";

  const tracks = await getTopTracks(accessToken, timeRange, 50);
  return NextResponse.json({ tracks });
}
