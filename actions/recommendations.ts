"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getTopArtists,
  getTopTracks,
  getSpotifyRecommendations,
  searchArtistsByGenre,
  getArtistTopTracks,
  getFollowedArtists,
  getSavedTrackArtistNames,
  searchArtist,
} from "@/lib/spotify";
import {
  filterAndScoreArtists,
  filterAndScoreTracks,
  applyFeedbackAdjustment,
  moodToGenres,
  type UserPreferences,
} from "@/lib/recommendation-engine";

export async function generateRecommendations(
  limit = 12,
  options?: { excludeSaved?: boolean }
) {
  try {
    return await generateRecommendationsInternal(
      limit,
      options?.excludeSaved ?? true
    );
  } catch (e: any) {
    console.error("[generateRecommendations]", e);
    // Temporär: genaue Ursache anzeigen, bis der Fehler gefunden ist
    const stackTop = (e?.stack ?? "").split("\n").slice(0, 3).join(" | ");
    return {
      success: false,
      error: `Fehler: ${e?.message ?? "Unbekannt"} [${stackTop}]`,
      items: [],
    };
  }
}

// Ähnliche Empfehlungen zu einer gut bewerteten Empfehlung generieren
export async function generateSimilarRecommendations(recommendationId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return { success: false, error: "Nicht authentifiziert", items: [] };

    const rec = await prisma.recommendation.findFirst({
      where: { id: recommendationId, userId: session.user.id },
    });
    if (!rec)
      return { success: false, error: "Empfehlung nicht gefunden", items: [] };

    // Genres des Künstlers über die Spotify-Suche verfeinern
    const accessToken = (session as any).accessToken as string | undefined;
    const refreshToken = (session as any).refreshToken as string | undefined;
    let genres: string[] = rec.genre ? [rec.genre] : [];
    if (accessToken) {
      const found = await searchArtist(accessToken, rec.artistName, refreshToken);
      const artistGenres = Array.isArray(found[0]?.genres)
        ? found[0]!.genres
        : [];
      genres = Array.from(new Set(genres.concat(artistGenres))).slice(0, 4);
    }
    if (genres.length === 0)
      return {
        success: false,
        error: "Kein Genre für die Ähnlichkeitssuche gefunden",
        items: [],
      };

    return await generateRecommendationsInternal(6, true, {
      genres,
      similarTo: rec.artistName,
    });
  } catch (e: any) {
    console.error("[generateSimilarRecommendations]", e);
    return {
      success: false,
      error: "Ähnliche Empfehlungen konnten nicht erstellt werden",
      items: [],
    };
  }
}

async function generateRecommendationsInternal(
  limit: number,
  excludeSaved: boolean,
  seed?: { genres: string[]; similarTo: string }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Nicht authentifiziert", items: [] };

  const userId = session.user.id;
  const accessToken = (session as any).accessToken as string | undefined;
  const refreshToken = (session as any).refreshToken as string | undefined;

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  const artistWeights = (profile?.artistWeights ?? {}) as Record<string, number>;
  const genreWeights = (profile?.genreWeights ?? {}) as Record<string, number>;

  const userPrefs: UserPreferences = {
    popularityThreshold: profile?.popularityThreshold ?? 70,
    topArtists: Array.isArray(profile?.topArtists)
      ? (profile!.topArtists as string[])
      : [],
    genreWeights,
    artistWeights,
    currentMood: profile?.currentMood ?? undefined,
    aestheticText: profile?.aestheticText ?? undefined,
  };

  let candidates = [];

  // Früher empfohlene Künstler merken, damit sich Empfehlungen nicht wiederholen
  const previousRecs = await prisma.recommendation.findMany({
    where: { userId },
    select: {
      artistName: true,
      trackName: true,
      feedback: { select: { category: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const alreadyRecommended = new Set<string>();
  const blockedTracks = new Set<string>();
  for (const r of previousRecs) {
    if (r.trackName)
      blockedTracks.add(`${r.artistName}::${r.trackName}`.toLowerCase());
    // «Song passt nicht, Künstler ok»: Künstler darf mit anderem Track wiederkommen
    if (r.feedback?.category === "track-only") continue;
    for (const n of r.artistName.split(", "))
      alreadyRecommended.add(n.toLowerCase());
  }

  if (accessToken) {
    const [topArtists, topTracks, followedArtists, savedArtistNames] =
      await Promise.all([
        getTopArtists(accessToken, "medium_term", 50, refreshToken),
        getTopTracks(accessToken, "medium_term", 50, refreshToken),
        excludeSaved
          ? getFollowedArtists(accessToken, refreshToken)
          : Promise.resolve([]),
        excludeSaved
          ? getSavedTrackArtistNames(accessToken, refreshToken)
          : Promise.resolve([]),
      ]);

    // Bereits bekannte Künstler: gehörte Top-Künstler, manuell gepflegte Liste,
    // alles bereits Empfohlene – und optional die Spotify-Bibliothek
    // (gefolgte Künstler + Künstler gespeicherter Songs)
    const knownArtists = new Set<string>(alreadyRecommended);
    for (const a of topArtists) knownArtists.add(a.name.toLowerCase());
    for (const name of userPrefs.topArtists) knownArtists.add(name.toLowerCase());
    for (const a of followedArtists) knownArtists.add(a.name.toLowerCase());
    for (const n of savedArtistNames) knownArtists.add(n.toLowerCase());

    // Genres für die Entdeckung: bevorzugte Genres aus dem Profil,
    // sonst die häufigsten Genres der gehörten Top-Künstler
    const preferredGenres = Object.keys(
      (profile?.genrePreferences ?? {}) as Record<string, number>
    );
    const genreCounts = new Map<string, number>();
    for (const a of topArtists) {
      const genres = Array.isArray(a.genres) ? a.genres : [];
      for (const g of genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
    const derivedGenres = Array.from(genreCounts.entries())
      .sort((x, y) => y[1] - x[1])
      .map(([g]) => g);

    // Profil-Genres zufällig mischen, damit bei vielen Genres
    // jede Generierung andere Ecken durchsucht
    const baseGenres = (
      preferredGenres.length > 0 ? preferredGenres : derivedGenres
    ).slice();
    for (let i = baseGenres.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [baseGenres[i], baseGenres[j]] = [baseGenres[j], baseGenres[i]];
    }

    // Stimmung übersetzt sich in Genres und hat Vorrang;
    // bei der Ähnlichkeitssuche zählen nur die Seed-Genres
    const moodGenres = moodToGenres(
      userPrefs.currentMood,
      userPrefs.aestheticText
    );
    const discoveryGenres = seed
      ? seed.genres.slice(0, 4)
      : Array.from(new Set(moodGenres.slice(0, 3).concat(baseGenres))).slice(
          0,
          6
        );

    // Neue Künstler über die Genre-Suche entdecken.
    // Zufälliger Offset, damit jede Generierung andere Treffer liefert.
    const searchResults = await Promise.all(
      discoveryGenres.map(async (g) => {
        // Grosses Offset-Fenster, damit der Kandidaten-Pool nicht erschöpft
        const offset = Math.floor(Math.random() * 8) * 25;
        const found = await searchArtistsByGenre(
          accessToken,
          g,
          40,
          refreshToken,
          offset
        );
        // Spotify liefert oft keine Genres mehr – dann das Such-Genre übernehmen
        return found.map((a) => ({
          ...a,
          genres:
            Array.isArray(a.genres) && a.genres.length > 0 ? a.genres : [g],
        }));
      })
    );
    const seenIds = new Set<string>();
    const discovered = searchResults.flat().filter((a) => {
      if (seenIds.has(a.id)) return false;
      seenIds.add(a.id);
      return true;
    });

    // Genre-Zuordnung für Track-Kandidaten aus den Top-Künstlern ableiten
    const artistGenreMap = new Map<string, string>();
    for (const a of topArtists) {
      const g = Array.isArray(a.genres) ? a.genres[0] : undefined;
      if (g) artistGenreMap.set(a.name.toLowerCase(), g);
    }
    const fillGenre = <T extends { artistName: string; genre?: string }>(
      cands: T[]
    ): T[] =>
      cands.map((c) =>
        c.genre
          ? c
          : {
              ...c,
              genre: artistGenreMap.get(
                (c.artistName.split(", ")[0] ?? "").toLowerCase()
              ),
            }
      );

    const artistCandidates = filterAndScoreArtists(discovered, userPrefs);
    const trackCandidates = fillGenre(filterAndScoreTracks(topTracks, userPrefs));

    // Spotify-Recommendations-Endpoint (liefert bei neueren Apps nichts mehr)
    const seedArtistIds = topArtists
      .filter((a) => a.popularity < userPrefs.popularityThreshold)
      .slice(0, 2)
      .map((a) => a.id);

    const seedGenres = discoveryGenres.slice(0, 3);

    const spotifyRecs =
      seedArtistIds.length > 0 || seedGenres.length > 0
        ? await getSpotifyRecommendations(
            accessToken,
            seedArtistIds,
            seedGenres,
            { maxPopularity: userPrefs.popularityThreshold, limit: 20 },
            refreshToken
          )
        : [];

    const recCandidates = fillGenre(filterAndScoreTracks(spotifyRecs, userPrefs));

    // Bekannte Künstler ausschliessen – Empfehlungen sollen Neuentdeckungen sein
    const isDiscovery = (c: { artistName: string }) =>
      !c.artistName
        .split(", ")
        .some((n) => knownArtists.has(n.toLowerCase()));

    candidates = [
      ...applyFeedbackAdjustment(artistCandidates, artistWeights, genreWeights),
      ...applyFeedbackAdjustment(recCandidates, artistWeights, genreWeights),
      ...applyFeedbackAdjustment(trackCandidates, artistWeights, genreWeights),
    ].filter(isDiscovery);
  } else {
    // No Spotify connection: use curated underground defaults
    candidates = getCuratedDefaults(userPrefs);
  }

  // Fallback: Spotify lieferte nichts (z.B. neues Konto, Token abgelaufen)
  if (candidates.length === 0) {
    candidates = getCuratedDefaults(userPrefs);
  }

  // Auch aus dem Fallback keine Künstler empfehlen, die schon im Profil stehen
  const profileArtists = new Set(
    userPrefs.topArtists.map((a) => a.toLowerCase())
  );
  candidates = candidates.filter(
    (c) => !profileArtists.has(c.artistName.toLowerCase())
  );

  // Wiederholungen strikt ausschliessen – lieber weniger Empfehlungen
  // als bereits bekannte Künstler erneut vorschlagen
  candidates = candidates.filter(
    (c) =>
      !c.artistName
        .split(", ")
        .some((n) => alreadyRecommended.has(n.toLowerCase()))
  );

  // Remove duplicates by artistName+trackName
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const key = `${c.artistName}::${c.trackName ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Aus den besten Kandidaten mischen, damit jede Generierung variiert
  const pool = unique.slice(0, limit * 3);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let top = pool.slice(0, limit);

  // Jeder Künstler-Empfehlung einen konkreten Song zuordnen –
  // bevorzugt die weniger populären der Top-Tracks (Deep Cuts)
  if (accessToken) {
    top = await Promise.all(
      top.map(async (c) => {
        if (c.trackName || !c.spotifyId) return c;
        const tracks = await getArtistTopTracks(
          accessToken,
          c.spotifyId,
          refreshToken
        );
        if (tracks.length === 0) return c;
        const deepCuts = tracks
          .slice()
          .sort((a, b) => (a.popularity ?? 0) - (b.popularity ?? 0))
          // Bereits empfohlene Songs dieses Künstlers nicht nochmal vorschlagen
          .filter(
            (t) =>
              !blockedTracks.has(`${c.artistName}::${t.name}`.toLowerCase())
          )
          .slice(0, 3);
        if (deepCuts.length === 0) return c;
        const pick = deepCuts[Math.floor(Math.random() * deepCuts.length)];
        return {
          ...c,
          trackName: pick.name,
          albumName: pick.album?.name,
          spotifyUrl: pick.external_urls?.spotify ?? c.spotifyUrl,
          coverUrl:
            (Array.isArray(pick.album?.images) && pick.album!.images[0]?.url) ||
            c.coverUrl,
          previewUrl: pick.preview_url ?? undefined,
        };
      })
    );
  }

  if (top.length === 0) {
    return {
      success: false,
      error:
        "Keine neuen Empfehlungen gefunden – alle Treffer wurden dir schon vorgeschlagen. Füge im Profil weitere Genres hinzu oder wähle eine andere Stimmung.",
      items: [],
    };
  }

  // Bei Ähnlichkeitssuche den Bezug in der Begründung ausweisen
  if (seed) {
    top = top.map((c) => ({
      ...c,
      reason: `Ähnlich zu ${seed.similarTo}`,
      tags: Array.isArray(c.tags) ? c.tags.concat("similar") : ["similar"],
    }));
  }

  // Alte Empfehlungen bleiben in der DB (Sperrliste gegen Wiederholungen)
  const saved = await prisma.$transaction(
    top.map((c) =>
      prisma.recommendation.create({
        data: {
          userId,
          artistName: c.artistName,
          trackName: c.trackName,
          albumName: c.albumName,
          genre: c.genre,
          spotifyId: c.spotifyId,
          spotifyUrl: c.spotifyUrl,
          coverUrl: c.coverUrl,
          previewUrl: c.previewUrl,
          popularity: c.popularity,
          qualityScore: c.qualityScore,
          undergroundScore: c.undergroundScore,
          reason: c.reason,
          tags: c.tags,
        },
      })
    )
  );

  revalidatePath("/dashboard");
  return { success: true, items: saved };
}

export async function getStoredRecommendations() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return [];

  return prisma.recommendation.findMany({
    where: { userId: session.user.id, dismissed: false },
    include: { feedback: true },
    orderBy: { createdAt: "desc" },
    take: 48,
  });
}

// Entfernt eine Empfehlung aus der Ansicht – bleibt aber in der DB,
// damit sie nie wieder vorgeschlagen wird
export async function dismissRecommendation(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return { success: false, error: "Nicht authentifiziert" };

  try {
    await prisma.recommendation.updateMany({
      where: { id, userId: session.user.id },
      data: { dismissed: true },
    });
  } catch (e) {
    console.error("[dismissRecommendation]", e);
    return { success: false, error: "Konnte nicht entfernt werden" };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

// Curated underground defaults – shown before Spotify connection
function getCuratedDefaults(prefs: UserPreferences) {
  const defaults = [
    {
      artistName: "Burial",
      genre: "uk garage",
      popularity: 42,
      reason: "Pionier des atmosphärischen UK Garage – absoluter Underground-Klassiker",
      tags: ["underground-gem", "uk garage", "atmospheric"],
      spotifyUrl: "https://open.spotify.com/artist/5RYMoUKoXO5oq7BkEaOdNq",
      coverUrl: "",
    },
    {
      artistName: "Four Tet",
      genre: "experimental",
      popularity: 54,
      reason: "Meister der elektronischen Texturen – tief und introspektiv",
      tags: ["experimental", "electronic"],
      spotifyUrl: "https://open.spotify.com/artist/7Eu1txygG6nJttLHbZdQOh",
      coverUrl: "",
    },
    {
      artistName: "Actress",
      genre: "minimal techno",
      popularity: 31,
      reason: "Obskurer Minimal-Techno mit roher emotionaler Tiefe",
      tags: ["obscure", "underground-gem", "minimal techno"],
      spotifyUrl: "https://open.spotify.com/artist/1w4XdR5gZJf7ANYsWjd8fE",
      coverUrl: "",
    },
    {
      artistName: "Andy Stott",
      genre: "industrial techno",
      popularity: 33,
      reason: "Industrielles Gewicht kombiniert mit subliminaler Melancholie",
      tags: ["obscure", "industrial", "underground-gem"],
      spotifyUrl: "https://open.spotify.com/artist/3ByqMOV0hjkIadW2wPuBaN",
      coverUrl: "",
    },
    {
      artistName: "Grouper",
      genre: "ambient",
      popularity: 45,
      reason: "Zerbrechliche Schönheit im Ambient-Bereich – einzigartig und zeitlos",
      tags: ["ambient", "underground-gem"],
      spotifyUrl: "https://open.spotify.com/artist/7GlBOeep4mWvRhYkIHHXZK",
      coverUrl: "",
    },
    {
      artistName: "William Basinski",
      genre: "drone",
      popularity: 38,
      reason: "Meditatives Drone-Meisterwerk – Musik als Zeit-Skulptur",
      tags: ["obscure", "drone", "ambient"],
      spotifyUrl: "https://open.spotify.com/artist/2O9X0K5KCmpIBxLqpTNy0A",
      coverUrl: "",
    },
  ];

  return defaults.map((d) => ({
    ...d,
    // Such-Link statt hartcodierter Artist-ID – funktioniert garantiert
    spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(d.artistName)}`,
    trackName: undefined,
    albumName: undefined,
    spotifyId: undefined,
    previewUrl: undefined,
    qualityScore: 0.8,
    undergroundScore: (100 - d.popularity) / 100,
  }));
}
