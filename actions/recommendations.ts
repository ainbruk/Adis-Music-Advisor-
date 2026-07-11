"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getTopArtists,
  getTopTracks,
  searchArtistsByGenre,
  getArtistTopTracks,
  getFollowedArtists,
  getSavedTracks,
  getUserPlaylists,
  getPlaylistTracks,
  searchArtist,
} from "@/lib/spotify";
import {
  filterAndScoreArtists,
  filterAndScoreTracks,
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

// Empfehlungen gezielt aus einer vom Nutzer gewählten Playlist
export async function generateFromPlaylist(
  playlistId: string,
  playlistName: string
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return { success: false, error: "Nicht authentifiziert", items: [] };

    const userId = session.user.id;
    const accessToken = (session as any).accessToken as string | undefined;
    const refreshToken = (session as any).refreshToken as string | undefined;
    if (!accessToken)
      return { success: false, error: "Spotify nicht verbunden", items: [] };

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    const userPrefs: UserPreferences = {
      popularityThreshold: profile?.popularityThreshold ?? 70,
      topArtists: Array.isArray(profile?.topArtists)
        ? (profile!.topArtists as string[])
        : [],
      genreWeights: (profile?.genreWeights ?? {}) as Record<string, number>,
      artistWeights: (profile?.artistWeights ?? {}) as Record<string, number>,
    };

    const previous = await prisma.recommendation.findMany({
      where: { userId },
      select: { artistName: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const blocked = new Set<string>();
    for (const r of previous)
      for (const n of r.artistName.split(", ")) blocked.add(n.toLowerCase());
    for (const n of userPrefs.topArtists) blocked.add(n.toLowerCase());

    const tracks = await getPlaylistTracks(
      accessToken,
      playlistId,
      refreshToken,
      50
    );
    const scored = filterAndScoreTracks(tracks, userPrefs).filter(
      (c) =>
        !c.artistName.split(", ").some((n) => blocked.has(n.toLowerCase()))
    );

    const seenKeys = new Set<string>();
    const top = scored
      .filter((c) => {
        const k = `${c.artistName}::${c.trackName ?? ""}`;
        if (seenKeys.has(k)) return false;
        seenKeys.add(k);
        return true;
      })
      .slice(0, 8)
      .map((c) => ({
        ...c,
        reason: `Aus deiner Playlist «${playlistName}»`,
        tags: c.tags.concat("aus-playlist"),
        scoreDetails: {
          score: Math.round(
            (c.qualityScore * 0.45 + c.undergroundScore * 0.3 + 0.05) * 100
          ),
          quality: Math.round(c.qualityScore * 100),
          underground: Math.round(c.undergroundScore * 100),
          popularity: c.popularity,
          source: "Playlist",
        },
      }));

    if (top.length === 0)
      return {
        success: false,
        error: `In «${playlistName}» wurde nichts Neues unter Popularität ${userPrefs.popularityThreshold} gefunden – die passenden Künstler kennst du schon oder wurden bereits vorgeschlagen.`,
        items: [],
        threshold: userPrefs.popularityThreshold,
      };

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
            scoreDetails: c.scoreDetails,
          },
        })
      )
    );

    revalidatePath("/dashboard");
    return { success: true, items: saved };
  } catch (e) {
    console.error("[generateFromPlaylist]", e);
    return {
      success: false,
      error: "Playlist konnte nicht durchsucht werden",
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
  let diagSearched = 0;
  let diagFresh = 0;
  let diagGenres: string[] = [];

  // Bevorzugte Genres und Stimmungs-Genres – fliessen in Suche UND Scoring ein
  const preferredGenres = Object.keys(
    (profile?.genrePreferences ?? {}) as Record<string, number>
  );
  const moodGenres = moodToGenres(
    userPrefs.currentMood,
    userPrefs.aestheticText
  );
  const preferredSet = new Set(preferredGenres.map((g) => g.toLowerCase()));
  const moodSet = new Set(moodGenres.map((g) => g.toLowerCase()));

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
    const [topArtists, topTracks, followedArtists, savedTracks] =
      await Promise.all([
        getTopArtists(accessToken, "medium_term", 50, refreshToken),
        getTopTracks(accessToken, "medium_term", 50, refreshToken),
        excludeSaved
          ? getFollowedArtists(accessToken, refreshToken)
          : Promise.resolve([]),
        getSavedTracks(accessToken, refreshToken),
      ]);

    const savedArtistNames = excludeSaved
      ? savedTracks.flatMap((t) =>
          (Array.isArray(t.artists) ? t.artists : []).map((a) => a.name)
        )
      : [];

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

    // Bekannte Künstler ausschliessen – Empfehlungen sollen Neuentdeckungen sein
    const isDiscovery = (c: { artistName: string }) =>
      !c.artistName
        .split(", ")
        .some((n) => knownArtists.has(n.toLowerCase()));

    // Genre-Pool: Stimmung zuerst, dann die gemischten Profil-Genres;
    // bei der Ähnlichkeitssuche zählen nur die Seed-Genres
    const genrePool = seed
      ? seed.genres.slice(0, 4)
      : Array.from(new Set(moodGenres.slice(0, 3).concat(baseGenres)));
    diagGenres = genrePool.slice(0, 16);

    const seenIds = new Set<string>();
    const searchWave = async (genres: string[], offsetBase: number) => {
      const results = await Promise.all(
        genres.map(async (g) => {
          const offset = offsetBase + Math.floor(Math.random() * 4) * 25;
          const found = await searchArtistsByGenre(
            accessToken,
            g,
            50,
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
      return results.flat().filter((a) => {
        if (seenIds.has(a.id)) return false;
        seenIds.add(a.id);
        return true;
      });
    };

    // Iterativ suchen: pro Welle andere Genres und tiefere Offsets,
    // bis genügend wirklich neue Künstler gefunden sind.
    // Läuft parallel zur Playlist-Suche (Zeitbudget der Function).
    const searchTask = (async () => {
      let fresh: ReturnType<typeof filterAndScoreArtists> = [];
      for (let wave = 0; wave < 4 && fresh.length < limit * 2; wave++) {
        const start =
          genrePool.length > 8 ? (wave * 8) % genrePool.length : 0;
        const genres = genrePool.slice(start, start + 8);
        if (genres.length === 0) break;
        const found = await searchWave(genres, wave * 75);
        fresh = fresh.concat(
          filterAndScoreArtists(found, userPrefs).filter(isDiscovery)
        );
      }
      return fresh;
    })();

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

    const trackCandidates = fillGenre(filterAndScoreTracks(topTracks, userPrefs));

    // Playlists durchforsten: unbekannte Künstler aus eigenen und
    // gefolgten Playlists (2–3 zufällige pro Generierung)
    const playlistTask = (async () => {
      const result: typeof trackCandidates = [];
      if (seed) return result;
      try {
        const playlists = await getUserPlaylists(accessToken, refreshToken);
        for (let i = playlists.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [playlists[i], playlists[j]] = [playlists[j], playlists[i]];
        }
        const picked = playlists.slice(0, 3);
        const plTracks = await Promise.all(
          picked.map((p) => getPlaylistTracks(accessToken, p.id, refreshToken))
        );
        picked.forEach((p, i) => {
          const scored = fillGenre(filterAndScoreTracks(plTracks[i], userPrefs));
          for (const c of scored.slice(0, 8)) {
            result.push({
              ...c,
              reason: `Aus deiner Playlist «${p.name}»`,
              tags: c.tags.concat("aus-playlist"),
            });
          }
        });
      } catch (e) {
        console.error("[playlistCandidates]", e);
      }
      return result;
    })();

    const [freshArtistCandidates, playlistCandidates] = await Promise.all([
      searchTask,
      playlistTask,
    ]);
    diagSearched = seenIds.size;
    diagFresh = freshArtistCandidates.length;

    // Bibliothek durchforsten: gespeicherte, wenig populäre Songs von
    // Künstlern, die du kaum hörst – vergessene Perlen (bewusst nicht
    // vom Bekannt-Filter ausgeschlossen)
    const activeArtistNames = new Set(
      topArtists.map((a) => a.name.toLowerCase())
    );
    const libraryCandidates = seed
      ? []
      : fillGenre(filterAndScoreTracks(savedTracks, userPrefs))
          .filter(
            (c) =>
              !c.artistName
                .split(", ")
                .some((n) => activeArtistNames.has(n.toLowerCase()))
          )
          .slice(0, 6)
          .map((c) => ({
            ...c,
            reason: "Vergessene Perle aus deiner Bibliothek",
            tags: c.tags.concat("aus-bibliothek"),
          }));

    candidates = [
      ...playlistCandidates.filter(isDiscovery).slice(0, 10),
      ...libraryCandidates.slice(0, 4),
      ...freshArtistCandidates,
      ...trackCandidates.filter(isDiscovery),
    ];
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

  // Komposit-Score mit nachvollziehbaren Faktoren:
  //   45% Qualität (inkl. Feedback-Gewichte für Künstler und Genre)
  //   30% Underground-Score (je unbekannter, desto höher)
  //  +12% Bonus bei Stimmungs-Treffer
  //   +8% Bonus bei bevorzugtem Genre aus dem Profil
  //   +5% Bonus für Funde aus Playlists/Bibliothek
  const scoreOf = (c: any) => {
    const g = (c.genre ?? "").toLowerCase();
    const tags: string[] = Array.isArray(c.tags) ? c.tags : [];
    const artistWeight = artistWeights[c.spotifyId ?? c.artistName] ?? 1.0;
    const genreWeight = g ? genreWeights[g] ?? 1.0 : 1.0;
    const genrePreferred = preferredSet.has(g);
    const moodMatch = moodSet.has(g);
    const fromCollection =
      tags.includes("aus-playlist") || tags.includes("aus-bibliothek");
    const quality = Math.max(
      0,
      Math.min(1, (c.qualityScore ?? 0.5) * artistWeight * genreWeight)
    );
    const final =
      quality * 0.45 +
      (c.undergroundScore ?? 0) * 0.3 +
      (moodMatch ? 0.12 : 0) +
      (genrePreferred ? 0.08 : 0) +
      (fromCollection ? 0.05 : 0);

    return {
      final,
      details: {
        score: Math.round(final * 100),
        quality: Math.round(quality * 100),
        underground: Math.round((c.undergroundScore ?? 0) * 100),
        popularity: c.popularity ?? null,
        artistWeight: Number(artistWeight.toFixed(2)),
        genreWeight: Number(genreWeight.toFixed(2)),
        genrePreferred,
        moodMatch,
        source: tags.includes("aus-playlist")
          ? "Playlist"
          : tags.includes("aus-bibliothek")
            ? "Bibliothek"
            : tags.includes("similar")
              ? "Ähnlichkeitssuche"
              : "Genre-Suche",
      },
    };
  };

  const ranked = unique
    .map((c) => {
      const s = scoreOf(c);
      return { ...c, finalScore: s.final, scoreDetails: s.details };
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  // Aus den besten Kandidaten mischen, damit jede Generierung variiert
  const pool = ranked.slice(0, limit * 3);
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
      error: `Keine neuen Empfehlungen gefunden (${diagSearched} Künstler geprüft, ${diagFresh} unverbraucht).`,
      items: [],
      // Für die "Nichts gefunden"-Erklärung inkl. Filter-Vorschlag im UI
      searchedGenres: diagGenres,
      threshold: userPrefs.popularityThreshold,
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
          scoreDetails: (c as any).scoreDetails ?? undefined,
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
