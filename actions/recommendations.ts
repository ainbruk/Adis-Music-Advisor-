"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getTopArtists,
  getTopTracks,
  getSpotifyRecommendations,
} from "@/lib/spotify";
import {
  filterAndScoreArtists,
  filterAndScoreTracks,
  applyFeedbackAdjustment,
  type UserPreferences,
} from "@/lib/recommendation-engine";

export async function generateRecommendations(limit = 12) {
  try {
    return await generateRecommendationsInternal(limit);
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

async function generateRecommendationsInternal(limit: number) {
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

  if (accessToken) {
    const [topArtists, topTracks] = await Promise.all([
      getTopArtists(accessToken, "medium_term", 50, refreshToken),
      getTopTracks(accessToken, "medium_term", 50, refreshToken),
    ]);

    const artistCandidates = filterAndScoreArtists(topArtists, userPrefs);
    const trackCandidates = filterAndScoreTracks(topTracks, userPrefs);

    // Get Spotify recommendations based on seed artists
    const seedArtistIds = topArtists
      .filter((a) => a.popularity < userPrefs.popularityThreshold)
      .slice(0, 2)
      .map((a) => a.id);

    const seedGenres = Object.keys(genreWeights)
      .filter((g) => (genreWeights[g] ?? 1) > 0.9)
      .slice(0, 3);

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

    const recCandidates = filterAndScoreTracks(spotifyRecs, userPrefs);

    candidates = [
      ...applyFeedbackAdjustment(artistCandidates, artistWeights, genreWeights),
      ...applyFeedbackAdjustment(recCandidates, artistWeights, genreWeights),
      ...applyFeedbackAdjustment(trackCandidates, artistWeights, genreWeights),
    ];
  } else {
    // No Spotify connection: use curated underground defaults
    candidates = getCuratedDefaults(userPrefs);
  }

  // Fallback: Spotify lieferte nichts (z.B. neues Konto, Token abgelaufen)
  if (candidates.length === 0) {
    candidates = getCuratedDefaults(userPrefs);
  }

  // Remove duplicates by artistName+trackName
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const key = `${c.artistName}::${c.trackName ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const top = unique.slice(0, limit);

  // Persist to DB (upsert approach: delete old pending, insert new)
  await prisma.recommendation.deleteMany({
    where: {
      userId,
      feedback: null,
      createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

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
    where: { userId: session.user.id },
    include: { feedback: true },
    orderBy: { createdAt: "desc" },
    take: 24,
  });
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
    trackName: undefined,
    albumName: undefined,
    spotifyId: undefined,
    previewUrl: undefined,
    qualityScore: 0.8,
    undergroundScore: (100 - d.popularity) / 100,
  }));
}
