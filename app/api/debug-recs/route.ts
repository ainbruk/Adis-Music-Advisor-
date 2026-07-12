import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getTopArtists,
  searchArtistsByGenre,
  searchPlaylists,
  getPlaylistTracks,
} from "@/lib/spotify";

export const maxDuration = 60;

// Diagnose: testet die Empfehlungs-Pipeline Schritt für Schritt.
// Optional mit ?genre=psytrance ein bestimmtes Genre durchspielen.
export async function GET(request: Request) {
  const t0 = Date.now();
  const out: any = { steps: [] };
  const step = (name: string, data: Record<string, unknown>) =>
    out.steps.push({ name, ms: Date.now() - t0, ...data });

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Keine Session – bitte anmelden" });

    const userId = session.user.id;
    const accessToken = (session as any).accessToken as string | undefined;
    const refreshToken = (session as any).refreshToken as string | undefined;
    out.hasAccessToken = !!accessToken;

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    const threshold = profile?.popularityThreshold ?? 70;
    const testGenre =
      new URL(request.url).searchParams.get("genre") ??
      (profile?.currentMood || "psytrance");
    out.testGenre = testGenre;
    step("profil", {
      popularitySchwelle: threshold,
      stimmung: profile?.currentMood ?? null,
    });

    const prev = await prisma.recommendation.findMany({
      where: { userId },
      select: { artistName: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const blocked = new Set(prev.map((r) => r.artistName.toLowerCase()));
    step("sperrliste", { gesperrteKuenstler: blocked.size });

    if (!accessToken) {
      out.fazit = "Kein Spotify-Token – bitte ab- und wieder anmelden";
      return NextResponse.json(out);
    }

    const topArtists = await getTopArtists(
      accessToken,
      "medium_term",
      50,
      refreshToken
    );
    step("spotifyTopArtists", { count: topArtists.length });

    // Quelle 1: Künstler-Suche (genre:-Filter + Freitext-Fallback)
    const artists = await searchArtistsByGenre(
      accessToken,
      testGenre,
      50,
      refreshToken,
      0
    );
    const artistsUnder = artists.filter(
      (a) => (a.popularity ?? 100) <= threshold
    );
    const artistsFresh = artistsUnder.filter(
      (a) => !blocked.has(a.name.toLowerCase())
    );
    step("kuenstlerSuche", {
      treffer: artists.length,
      unterSchwelle: artistsUnder.length,
      unverbraucht: artistsFresh.length,
      beispiele: artistsFresh.slice(0, 5).map((a) => `${a.name} (${a.popularity})`),
    });

    // Quelle 2: Genre-Playlists
    const playlists = await searchPlaylists(
      accessToken,
      testGenre,
      refreshToken,
      3
    );
    step("playlistSuche", {
      treffer: playlists.length,
      namen: playlists.map((p) => p.name),
    });

    if (playlists.length > 0) {
      const tracks = await getPlaylistTracks(
        accessToken,
        playlists[0].id,
        refreshToken
      );
      const under = tracks.filter((t) => (t.popularity ?? 100) <= threshold);
      const fresh = under.filter(
        (t) =>
          !t.artists.some((a) => blocked.has((a.name ?? "").toLowerCase()))
      );
      step("playlistTracks", {
        playlist: playlists[0].name,
        tracks: tracks.length,
        unterSchwelle: under.length,
        unverbraucht: fresh.length,
        beispiele: fresh
          .slice(0, 5)
          .map((t) => `${t.artists[0]?.name} – ${t.name} (${t.popularity})`),
      });
    }

    out.fazit =
      "Sind bei kuenstlerSuche UND playlistTracks 'unverbraucht' > 0, findet die Generierung Material.";
    return NextResponse.json(out);
  } catch (e: any) {
    out.error = e?.message ?? "Unbekannt";
    out.stack = (e?.stack ?? "").split("\n").slice(0, 4);
    return NextResponse.json(out);
  }
}
