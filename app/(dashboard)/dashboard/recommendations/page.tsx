import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoredRecommendations } from "@/actions/recommendations";
import { getUserPlaylists } from "@/lib/spotify";
import { RecommendationsView } from "@/components/RecommendationsView";

// Server Actions dieser Seite (Generierung) brauchen mehr Zeit als
// die Standard-Limite von 10s
export const maxDuration = 60;

export default async function RecommendationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  let recs: any[] = [];
  let currentMood = "";
  let threshold = 70;
  let playlists: { id: string; name: string }[] = [];

  try {
    recs = await getStoredRecommendations();
    const profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: { currentMood: true, popularityThreshold: true },
    });
    currentMood = profile?.currentMood ?? "";
    threshold = profile?.popularityThreshold ?? 70;
  } catch {
    // DB nicht konfiguriert
  }

  const accessToken = (session as any).accessToken as string | undefined;
  if (accessToken) {
    try {
      playlists = (
        await getUserPlaylists(accessToken, (session as any).refreshToken)
      ).map((p) => ({ id: p.id, name: p.name }));
    } catch {
      // Playlists nicht abrufbar – Auswahl einfach ausblenden
    }
  }

  return (
    <RecommendationsView
      initialRecs={recs}
      hasSpotify={!!accessToken}
      initialMood={currentMood}
      initialThreshold={threshold}
      playlists={playlists}
    />
  );
}
