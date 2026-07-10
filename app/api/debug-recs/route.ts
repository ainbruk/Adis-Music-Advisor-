import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTopArtists, searchArtistsByGenre } from "@/lib/spotify";

export const maxDuration = 60;

// Diagnose: testet die Empfehlungs-Pipeline Schritt für Schritt
export async function GET() {
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
    out.hasRefreshToken = !!refreshToken;

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    const preferredGenres = Object.keys(
      (profile?.genrePreferences ?? {}) as Record<string, number>
    );
    const threshold = profile?.popularityThreshold ?? 70;
    step("profil", {
      bevorzugteGenres: preferredGenres.length,
      popularitySchwelle: threshold,
      stimmung: profile?.currentMood ?? null,
    });

    const [prevCount, prev] = await Promise.all([
      prisma.recommendation.count({ where: { userId } }),
      prisma.recommendation.findMany({
        where: { userId },
        select: { artistName: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);
    const blocked = new Set(prev.map((r) => r.artistName.toLowerCase()));
    step("sperrliste", {
      empfehlungenInDb: prevCount,
      gesperrteKuenstler: blocked.size,
    });

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
    step("spotifyTopArtists", {
      count: topArtists.length,
      hinweis:
        topArtists.length === 0
          ? "0 = Token abgelaufen/ungültig oder keine Hördaten"
          : "ok",
    });

    // Probesuche in bis zu 3 Genres
    const testGenres = (
      preferredGenres.length > 0
        ? preferredGenres
        : ["ambient", "experimental", "indie folk"]
    ).slice(0, 3);

    for (const g of testGenres) {
      const found = await searchArtistsByGenre(
        accessToken,
        g,
        50,
        refreshToken,
        0
      );
      const underThreshold = found.filter(
        (a) => (a.popularity ?? 100) <= threshold
      );
      const fresh = underThreshold.filter(
        (a) => !blocked.has(a.name.toLowerCase())
      );
      step(`suche:${g}`, {
        treffer: found.length,
        unterPopularitySchwelle: underThreshold.length,
        unverbraucht: fresh.length,
        beispieleUnverbraucht: fresh.slice(0, 3).map((a) => a.name),
      });
    }

    out.fazit =
      "Wenn 'treffer' 0 ist: Token/Suche defekt. Wenn 'unverbraucht' überall 0: Sperrliste erschöpft.";
    return NextResponse.json(out);
  } catch (e: any) {
    out.error = e?.message ?? "Unbekannt";
    out.stack = (e?.stack ?? "").split("\n").slice(0, 4);
    return NextResponse.json(out);
  }
}
