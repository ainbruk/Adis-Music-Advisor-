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

export interface SpotifyAlbum {
  id: string;
  name: string;
  release_date: string;
  images: { url: string; width: number; height: number }[];
  external_urls: { spotify: string };
  album_type: string;
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
    // no-store: Der Next.js-Daten-Cache ignoriert Auth-Header im Cache-Key
    // und kann sonst leere/fremde Antworten wiederverwenden
    return fetch(`https://api.spotify.com/v1${endpoint}`, {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
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
  return Array.isArray(data?.items) ? data!.items : [];
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
  return Array.isArray(data?.items) ? data!.items : [];
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
  return Array.isArray(data?.tracks) ? data!.tracks : [];
}

// Gefolgte Künstler (Bibliothek > Künstler). Benötigt Scope user-follow-read –
// fehlt der Scope beim Token, kommt einfach eine leere Liste zurück.
export async function getFollowedArtists(
  accessToken: string,
  refreshToken?: string,
  max = 150
): Promise<SpotifyArtist[]> {
  const out: SpotifyArtist[] = [];
  let after: string | undefined;

  while (out.length < max) {
    const params = new URLSearchParams({ type: "artist", limit: "50" });
    if (after) params.set("after", after);
    const data = await spotifyFetch<{
      artists: { items: SpotifyArtist[]; cursors?: { after?: string | null } };
    }>(`/me/following?${params}`, accessToken, refreshToken);

    const items = Array.isArray(data?.artists?.items)
      ? data!.artists.items
      : [];
    if (items.length === 0) break;
    out.push(...items);
    after = data?.artists?.cursors?.after ?? undefined;
    if (!after) break;
  }

  return out;
}

// Zuletzt gespeicherte Songs (Bibliothek > Titel)
export async function getSavedTracks(
  accessToken: string,
  refreshToken?: string,
  pages = 2
): Promise<SpotifyTrack[]> {
  const out: SpotifyTrack[] = [];

  for (let i = 0; i < pages; i++) {
    const data = await spotifyFetch<{ items: { track: SpotifyTrack }[] }>(
      `/me/tracks?limit=50&offset=${i * 50}`,
      accessToken,
      refreshToken
    );
    const items = Array.isArray(data?.items) ? data!.items : [];
    for (const it of items) if (it?.track?.id) out.push(it.track);
    if (items.length < 50) break;
  }

  return out;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  tracks?: { total: number };
  owner?: { id?: string; display_name?: string };
}

// Eigene und gefolgte (verlinkte) Playlists
export async function getUserPlaylists(
  accessToken: string,
  refreshToken?: string,
  limit = 30
): Promise<SpotifyPlaylist[]> {
  const data = await spotifyFetch<{ items: SpotifyPlaylist[] }>(
    `/me/playlists?limit=${limit}`,
    accessToken,
    refreshToken
  );
  return Array.isArray(data?.items) ? data!.items.filter(Boolean) : [];
}

export async function getPlaylistTracks(
  accessToken: string,
  playlistId: string,
  refreshToken?: string,
  limit = 50
): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ items: { track: SpotifyTrack | null }[] }>(
    `/playlists/${playlistId}/tracks?limit=${limit}`,
    accessToken,
    refreshToken
  );
  const items = Array.isArray(data?.items) ? data!.items : [];
  return items
    .map((i) => i?.track)
    .filter((t): t is SpotifyTrack => !!t && !!t.id);
}

export async function getArtistLatestAlbum(
  accessToken: string,
  artistId: string,
  refreshToken?: string
): Promise<SpotifyAlbum | null> {
  const data = await spotifyFetch<{ items: SpotifyAlbum[] }>(
    `/artists/${artistId}/albums?include_groups=album&limit=5`,
    accessToken,
    refreshToken
  );
  const items = Array.isArray(data?.items) ? data!.items : [];
  if (items.length === 0) return null;
  // Neuestes Album zuerst
  return items
    .slice()
    .sort((a, b) =>
      (b.release_date ?? "").localeCompare(a.release_date ?? "")
    )[0];
}

export async function getArtistTopTracks(
  accessToken: string,
  artistId: string,
  refreshToken?: string
): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ tracks: SpotifyTrack[] }>(
    `/artists/${artistId}/top-tracks?market=from_token`,
    accessToken,
    refreshToken
  );
  return Array.isArray(data?.tracks) ? data!.tracks : [];
}

export async function searchArtistsByGenre(
  accessToken: string,
  genre: string,
  limit = 20,
  refreshToken?: string,
  offset = 0
): Promise<SpotifyArtist[]> {
  const params = new URLSearchParams({
    q: `genre:"${genre}"`,
    type: "artist",
    limit: String(limit),
    offset: String(offset),
  });
  const data = await spotifyFetch<{ artists: { items: SpotifyArtist[] } }>(
    `/search?${params}`,
    accessToken,
    refreshToken
  );
  let items = Array.isArray(data?.artists?.items) ? data!.artists.items : [];

  // Der genre:-Filter liefert seit den Spotify-API-Änderungen oft nichts
  // mehr – dann als freie Künstler-Suche mit dem Genre-Begriff versuchen
  if (items.length < 5 && offset === 0) {
    const alt = new URLSearchParams({
      q: genre,
      type: "artist",
      limit: String(limit),
    });
    const altData = await spotifyFetch<{ artists: { items: SpotifyArtist[] } }>(
      `/search?${alt}`,
      accessToken,
      refreshToken
    );
    const altItems = Array.isArray(altData?.artists?.items)
      ? altData!.artists.items
      : [];
    const seen = new Set(items.map((i) => i.id));
    items = items.concat(altItems.filter((a) => !seen.has(a.id)));
  }

  return items;
}

// Playlists zu einem Suchbegriff (z.B. Genre) finden – die zuverlässigste
// Entdeckungsquelle, seit der genre:-Filter kaum mehr bedient wird
export async function searchPlaylists(
  accessToken: string,
  query: string,
  refreshToken?: string,
  limit = 5
): Promise<SpotifyPlaylist[]> {
  const params = new URLSearchParams({
    q: query,
    type: "playlist",
    limit: String(limit),
  });
  const data = await spotifyFetch<{
    playlists: { items: (SpotifyPlaylist | null)[] };
  }>(`/search?${params}`, accessToken, refreshToken);
  const items = Array.isArray(data?.playlists?.items)
    ? data!.playlists.items
    : [];
  return items.filter((p): p is SpotifyPlaylist => !!p && !!p.id);
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
