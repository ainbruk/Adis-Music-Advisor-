import type { SpotifyArtist, SpotifyTrack } from "@/lib/spotify";

export interface RecommendationCandidate {
  artistName: string;
  trackName?: string;
  albumName?: string;
  genre?: string;
  spotifyId?: string;
  spotifyUrl?: string;
  coverUrl?: string;
  previewUrl?: string;
  popularity: number;
  qualityScore: number;
  undergroundScore: number;
  reason: string;
  tags: string[];
}

export interface UserPreferences {
  popularityThreshold: number;
  topArtists: string[];
  genreWeights: Record<string, number>;
  artistWeights: Record<string, number>;
  currentMood?: string;
  aestheticText?: string;
}

// Simulated critic scores (in production via AOTY/Last.fm APIs)
const UNDERGROUND_GENRE_BONUS: Record<string, number> = {
  "ambient":             0.9,
  "drone":               0.95,
  "experimental":        0.85,
  "post-rock":           0.8,
  "neo-soul":            0.75,
  "dream pop":           0.8,
  "shoegaze":            0.85,
  "krautrock":           0.9,
  "minimal techno":      0.85,
  "melodic techno":      0.8,
  "deep house":          0.75,
  "progressive house":   0.7,
  "uk garage":           0.7,
  "afrobeat":            0.75,
  "jazz fusion":         0.8,
  "contemporary jazz":   0.82,
  "bedroom pop":         0.78,
  "lo-fi":               0.72,
  "indie folk":          0.7,
  "darkwave":            0.88,
  "post-punk":           0.85,
  "coldwave":            0.9,
  "industrial":          0.85,
  "noise":               0.92,
  "black metal":         0.87,
  "doom metal":          0.84,
};

// Stimmung → Genres: übersetzt die Profil-Stimmung in Such-Genres,
// damit die Entdeckung wirklich der Stimmung folgt (deutsch + englisch)
const MOOD_GENRE_MAP: { keywords: string[]; genres: string[] }[] = [
  {
    keywords: ["melanchol", "traurig", "sad", "wehmüt", "bittersweet", "sehnsucht", "longing"],
    genres: ["singer-songwriter", "slowcore", "chamber pop", "indie folk"],
  },
  {
    keywords: ["verträumt", "dream", "ethereal", "schweb"],
    genres: ["dream pop", "shoegaze", "ethereal wave"],
  },
  {
    keywords: ["nachdenklich", "introspek", "tief", "deep", "profound", "thoughtful"],
    genres: ["modern classical", "neo-classical", "slowcore", "ambient"],
  },
  {
    keywords: ["ruhig", "calm", "entspann", "chill", "sanft", "soft"],
    genres: ["ambient", "downtempo", "lo-fi"],
  },
  {
    keywords: ["dunkel", "dark", "düster", "brooding", "moody"],
    genres: ["darkwave", "dark ambient", "industrial", "doom metal"],
  },
  {
    keywords: ["energisch", "energetic", "treibend", "driving", "kraftvoll", "powerful", "intens"],
    genres: ["techno", "drum and bass", "post-punk"],
  },
  {
    keywords: ["groov", "funky", "tanzbar", "danceable"],
    genres: ["funk", "disco", "deep house", "afrobeat"],
  },
  {
    keywords: ["euphor", "uplifting", "happy", "froh", "hell"],
    genres: ["progressive house", "trance", "synth-pop"],
  },
];

export function moodToGenres(mood?: string, aesthetic?: string): string[] {
  const text = `${mood ?? ""} ${aesthetic ?? ""}`.toLowerCase();
  if (!text.trim()) return [];
  const genres: string[] = [];
  for (const { keywords, genres: gs } of MOOD_GENRE_MAP) {
    if (keywords.some((k) => text.includes(k))) {
      for (const g of gs) if (!genres.includes(g)) genres.push(g);
    }
  }
  return genres;
}

// Funktionale Audio-Inhalte, die keine Musik-Entdeckungen sind:
// Devotional-Aufnahmen, Meditations-/Schlaf-Sounds, ASMR usw.
const NOISE_KEYWORDS = [
  "stotram",
  "mantra",
  "bhajan",
  "kirtan",
  "devotional",
  "meditation",
  "sleep",
  "schlaf",
  "white noise",
  "brown noise",
  "rain sound",
  "nature sound",
  "asmr",
  "lullaby",
  "wiegenlied",
  "yoga",
  "healing",
  "binaural",
  "study music",
  "8d audio",
  "baby",
  "relaxing spa",
];

function isNoiseText(text: string): boolean {
  const hay = text.toLowerCase();
  return NOISE_KEYWORDS.some((k) => hay.includes(k));
}

function extractMoodKeywords(mood?: string, aesthetic?: string): string[] {
  const text = `${mood ?? ""} ${aesthetic ?? ""}`.toLowerCase();
  const keywords: string[] = [];

  const mappings: Record<string, string[]> = {
    "melancholic":      ["melancholic", "sad", "bittersweet", "longing"],
    "energetic":        ["energetic", "driving", "intense", "powerful"],
    "deep":             ["deep", "profound", "introspective", "thoughtful"],
    "atmospheric":      ["atmospheric", "ambient", "spacious", "ethereal"],
    "dark":             ["dark", "moody", "brooding", "sinister"],
    "groovy":           ["groovy", "funky", "rhythmic", "danceable"],
    "underground":      ["underground", "niche", "obscure", "cult"],
    "progressive":      ["progressive", "complex", "layered", "evolving"],
  };

  for (const [key, terms] of Object.entries(mappings)) {
    if (terms.some((t) => text.includes(t))) keywords.push(key);
  }

  return keywords;
}

function computeUndergroundScore(
  popularity: number,
  genres: string[],
  threshold: number
): number {
  // Low popularity relative to threshold = higher underground score
  const popularityPenalty = Math.max(0, (popularity - threshold) / threshold);
  const popularityBonus = Math.max(0, (threshold - popularity) / threshold);

  let genreBonus = 0;
  for (const genre of genres) {
    const lowerGenre = genre.toLowerCase();
    for (const [key, bonus] of Object.entries(UNDERGROUND_GENRE_BONUS)) {
      if (lowerGenre.includes(key)) {
        genreBonus = Math.max(genreBonus, bonus);
        break;
      }
    }
  }

  return Math.min(
    1,
    0.4 + popularityBonus * 0.4 + genreBonus * 0.2 - popularityPenalty * 0.3
  );
}

function computeQualityScore(
  artist: SpotifyArtist,
  userPrefs: UserPreferences
): number {
  let score = 0.5;

  // Boost if artist is in user's top list
  const artistLower = artist.name.toLowerCase();
  const topList = Array.isArray(userPrefs.topArtists) ? userPrefs.topArtists : [];
  const inTopList = topList.some((a) => a.toLowerCase() === artistLower);
  if (inTopList) score += 0.3;

  // Apply user's artist weight (feedback-adjusted)
  const weight = userPrefs.artistWeights[artist.id] ?? 1.0;
  score *= weight;

  // Genre affinity
  for (const genre of artist.genres) {
    const gw = userPrefs.genreWeights[genre] ?? 1.0;
    score += (gw - 1.0) * 0.05;
  }

  // Follower diversity bonus (moderate following suggests cult status)
  const followers = artist.followers.total;
  if (followers > 10_000 && followers < 500_000) score += 0.1;
  else if (followers >= 500_000 && followers < 2_000_000) score += 0.05;

  return Math.max(0, Math.min(1, score));
}

function buildReasonString(
  artist: SpotifyArtist,
  moodKeywords: string[],
  undergroundScore: number,
  prefs: UserPreferences
): string {
  const reasons: string[] = [];

  if (artist.popularity < 40) reasons.push("ausserordentlich wenig bekannt");
  else if (artist.popularity < prefs.popularityThreshold)
    reasons.push("angenehm unter dem Mainstream-Radar");

  const matchedGenres = artist.genres.filter(
    (g) => UNDERGROUND_GENRE_BONUS[g.toLowerCase()] !== undefined
  );
  if (matchedGenres.length > 0)
    reasons.push(`tief verwurzelt im ${matchedGenres[0]}-Sound`);

  if (moodKeywords.includes("melancholic"))
    reasons.push("trägt die gewünschte Melancholie");
  if (moodKeywords.includes("atmospheric"))
    reasons.push("schafft dichte atmosphärische Texturen");
  if (moodKeywords.includes("underground"))
    reasons.push("echter Underground-Geheimtipp");

  if (undergroundScore > 0.8) reasons.push("Perle mit hohem Entdeckungswert");

  return reasons.length > 0
    ? reasons.join(" · ")
    : "Passt zu deinem musikalischen Profil";
}

export function filterAndScoreArtists(
  artists: SpotifyArtist[],
  userPrefs: UserPreferences
): RecommendationCandidate[] {
  const moodKeywords = extractMoodKeywords(
    userPrefs.currentMood,
    userPrefs.aestheticText
  );

  const candidates: RecommendationCandidate[] = [];
  const topArtists = Array.isArray(userPrefs.topArtists)
    ? userPrefs.topArtists
    : [];

  for (const rawArtist of artists) {
    // Spotify liefert genres/images nicht immer – defensiv absichern
    const artist = {
      ...rawArtist,
      genres: Array.isArray(rawArtist.genres) ? rawArtist.genres : [],
      images: Array.isArray(rawArtist.images) ? rawArtist.images : [],
      followers: rawArtist.followers ?? { total: 0 },
    };
    const isInTopList = topArtists.some(
      (a) => a.toLowerCase() === artist.name.toLowerCase()
    );

    // Filter: skip too-popular artists unless they're explicitly saved by user
    if (artist.popularity > userPrefs.popularityThreshold && !isInTopList) {
      continue;
    }

    // Qualitäts-Untergrenzen: funktionale Inhalte (Mantras, Schlaf-Sounds …)
    // und Junk-Profile sind keine Underground-Entdeckungen
    if (isNoiseText(`${artist.name} ${artist.genres.join(" ")}`)) continue;
    if (!isInTopList && artist.popularity < 5) continue;
    if (!isInTopList && (artist.followers?.total ?? 0) < 300) continue;

    const undergroundScore = computeUndergroundScore(
      artist.popularity,
      artist.genres,
      userPrefs.popularityThreshold
    );
    const qualityScore = computeQualityScore(artist, userPrefs);

    const genre = artist.genres[0] ?? "Various";
    const coverUrl =
      artist.images.sort((a, b) => b.width - a.width)[0]?.url ?? "";

    const tags: string[] = [
      ...(artist.popularity < 40 ? ["obscure"] : []),
      ...(undergroundScore > 0.75 ? ["underground-gem"] : []),
      ...(isInTopList ? ["in-your-top"] : []),
      ...artist.genres.slice(0, 2),
    ];

    candidates.push({
      artistName: artist.name,
      genre,
      spotifyId: artist.id,
      // external_urls fehlt bei Suchergebnissen manchmal – URL aus der ID bauen
      spotifyUrl:
        artist.external_urls?.spotify ??
        (artist.id
          ? `https://open.spotify.com/artist/${artist.id}`
          : undefined),
      coverUrl,
      popularity: artist.popularity,
      qualityScore,
      undergroundScore,
      reason: buildReasonString(
        artist,
        moodKeywords,
        undergroundScore,
        userPrefs
      ),
      tags,
    });
  }

  // Sort: highest combined score first (quality + underground)
  candidates.sort(
    (a, b) =>
      b.qualityScore * 0.6 +
      b.undergroundScore * 0.4 -
      (a.qualityScore * 0.6 + a.undergroundScore * 0.4)
  );

  return candidates;
}

export function filterAndScoreTracks(
  tracks: SpotifyTrack[],
  userPrefs: UserPreferences
): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = [];

  for (const rawTrack of tracks) {
    // Spotify liefert album/artists nicht immer vollständig – defensiv absichern
    const track = {
      ...rawTrack,
      artists: Array.isArray(rawTrack.artists) ? rawTrack.artists : [],
      album: {
        ...(rawTrack.album ?? { id: "", name: "", release_date: "" }),
        images: Array.isArray(rawTrack.album?.images)
          ? rawTrack.album.images
          : [],
      },
    };
    if (track.popularity > userPrefs.popularityThreshold) continue;

    // Funktionale Audio-Inhalte aussortieren (Mantras, Schlaf-Sounds …)
    if (
      isNoiseText(
        `${track.artists.map((a) => a.name).join(" ")} ${track.name}`
      )
    )
      continue;

    const popularity = track.popularity;
    const undergroundScore = Math.max(
      0,
      (userPrefs.popularityThreshold - popularity) /
        userPrefs.popularityThreshold
    );
    const qualityScore =
      0.5 +
      undergroundScore * 0.3 +
      (userPrefs.genreWeights["any"] ?? 1.0) * 0.1;

    const coverUrl =
      track.album.images.sort((a, b) => b.width - a.width)[0]?.url ?? "";

    candidates.push({
      artistName: track.artists.map((a) => a.name).join(", "),
      trackName: track.name,
      albumName: track.album.name,
      spotifyId: track.id,
      spotifyUrl:
        track.external_urls?.spotify ??
        (track.id ? `https://open.spotify.com/track/${track.id}` : undefined),
      coverUrl,
      previewUrl: track.preview_url ?? undefined,
      popularity,
      qualityScore,
      undergroundScore,
      reason: `Veröffentlicht ${track.album.release_date?.slice(0, 4)} · Popularität: ${popularity}/100`,
      tags: [
        ...(popularity < 30 ? ["obscure"] : []),
        ...(undergroundScore > 0.6 ? ["underground-gem"] : []),
      ],
    });
  }

  candidates.sort((a, b) => b.undergroundScore - a.undergroundScore);
  return candidates;
}

export function applyFeedbackAdjustment(
  candidates: RecommendationCandidate[],
  artistWeights: Record<string, number>,
  genreWeights: Record<string, number>
): RecommendationCandidate[] {
  return candidates.map((c) => {
    const aw = artistWeights[c.spotifyId ?? c.artistName] ?? 1.0;
    const gw = genreWeights[c.genre ?? ""] ?? 1.0;
    const adjustedQuality = Math.max(0, Math.min(1, c.qualityScore * aw * gw));
    return { ...c, qualityScore: adjustedQuality };
  }).sort(
    (a, b) =>
      b.qualityScore * 0.6 +
      b.undergroundScore * 0.4 -
      (a.qualityScore * 0.6 + a.undergroundScore * 0.4)
  );
}
