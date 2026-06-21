export interface SoundCloudTrack {
  id: number;
  title: string;
  permalink_url: string;
  artwork_url: string | null;
  user: {
    username: string;
    permalink_url: string;
    avatar_url: string;
  };
  playback_count: number;
  likes_count: number;
  genre: string;
  description: string | null;
  duration: number;
}

export function getSoundCloudEmbedUrl(trackUrl: string): string {
  const encoded = encodeURIComponent(trackUrl);
  return `https://w.soundcloud.com/player/?url=${encoded}&color=%238b5cf6&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`;
}

export function buildSoundCloudSearchUrl(query: string): string {
  return `https://soundcloud.com/search?q=${encodeURIComponent(query)}`;
}

export async function searchSoundCloud(
  query: string,
  genre?: string
): Promise<SoundCloudTrack[]> {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  if (!clientId) return [];

  const params = new URLSearchParams({
    q: genre ? `${query} ${genre}` : query,
    limit: "10",
    client_id: clientId,
  });

  try {
    const res = await fetch(
      `https://api.soundcloud.com/tracks?${params}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function getArtworkUrl(track: SoundCloudTrack, size = "t500x500"): string {
  if (!track.artwork_url) return "/placeholder-track.jpg";
  return track.artwork_url.replace("large", size);
}
