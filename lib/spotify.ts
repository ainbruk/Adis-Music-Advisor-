export interface SpotifyArtist {
  id: string;
  name: string;
  popularity: number;
  genres: string[];
  images: { url: string; width: number; height: number }[];
  external_urls: { spotify: string };
  followers: { total: number };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  popularity: number;
  artists: { id: string; name: string }[];
  album: {
    id: string;
    name: string;
    images: { url: string; width: number; height: number }[];
    release_date: string;
  };
  preview_url: string | null;
  external_urls: { spotify: string };
  duration_ms: number;
}

export interface SpotifyRecommendation {
  tracks: SpotifyTrack[];
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

async function spotifyFetch<T>(
  endpoint: string,
  accessToken: string,
  refreshToken?: string
): Promise<T | null> {
  let token = accessToken;

  const makeRequest = async (t: string) => {
    return fetch(`https://api.spotify.com/v1${endpoint}`, {
      headers: { Authorization: `Bearer ${t}` },
      next: { revalidate: 300 },
    });
  };

  let res = await makeRequest(token);

  if (res.status === 401 && refreshToken) {
    const newToken = await refreshAccessToken(refreshToken);
    if (!newToken) return null;
    token = newToken;
    res = await makeRequest(token);
  }

  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

export async function getTopArtists(
  accessToken: string,
  timeRange: "short_term" | "medium_term" | "long_term" = "medium_term",
  limit = 50,
  refreshToken?: string
): Promise<SpotifyArtist[]> {
  const data = await spotifyFetch<{ items: SpotifyArtist[] }>(
    `/me/top/artists?time_range=${timeRange}&limit=${limit}`,
    accessToken,
    refreshToken
  );
  return data?.items ?? [];
}

export async function getTopTracks(
  accessToken: string,
  timeRange: "short_term" | "medium_term" | "long_term" = "medium_term",
  limit = 50,
  refreshToken?: string
): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ items: SpotifyTrack[] }>(
    `/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
    accessToken,
    refreshToken
  );
  return data?.items ?? [];
}

export async function getRecentlyPlayed(
  accessToken: string,
  limit = 50,
  refreshToken?: string
): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{
    items: { track: SpotifyTrack }[];
  }>(
    `/me/player/recently-played?limit=${limit}`,
    accessToken,
    refreshToken
  );
  return data?.items.map((i) => i.track) ?? [];
}

export async function getSpotifyRecommendations(
  accessToken: string,
  seedArtistIds: string[],
  seedGenres: string[],
  options: {
    maxPopularity?: number;
    minEnergy?: number;
    limit?: number;
  } = {},
  refreshToken?: string
): Promise<SpotifyTrack[]> {
  const { maxPopularity = 65, limit = 20 } = options;

  const seedArtists = seedArtistIds.slice(0, 2).join(",");
  const seedGenresStr = seedGenres.slice(0, 3).join(",");

  const params = new URLSearchParams({
    limit: String(limit),
    max_popularity: String(maxPopularity),
    ...(seedArtists && { seed_artists: seedArtists }),
    ...(seedGenresStr && { seed_genres: seedGenresStr }),
  });

  const data = await spotifyFetch<SpotifyRecommendation>(
    `/recommendations?${params}`,
    accessToken,
    refreshToken
  );
  return data?.tracks ?? [];
}

export async function searchArtist(
  accessToken: string,
  query: string,
  refreshToken?: string
): Promise<SpotifyArtist[]> {
  const params = new URLSearchParams({ q: query, type: "artist", limit: "5" });
  const data = await spotifyFetch<{ artists: { items: SpotifyArtist[] } }>(
    `/search?${params}`,
    accessToken,
    refreshToken
  );
  return data?.artists.items ?? [];
}

export function getArtistImageUrl(artist: SpotifyArtist): string {
  return (
    artist.images.sort((a, b) => b.width - a.width)[0]?.url ??
    "/placeholder-artist.jpg"
  );
}

export function getTrackImageUrl(track: SpotifyTrack): string {
  return (
    track.album.images.sort((a, b) => b.width - a.width)[0]?.url ??
    "/placeholder-track.jpg"
  );
}
