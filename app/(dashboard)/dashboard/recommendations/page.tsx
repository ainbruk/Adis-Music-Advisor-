import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoredRecommendations } from "@/actions/recommendations";
import { RecommendationsView } from "@/components/RecommendationsView";

export default async function RecommendationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  let recs: any[] = [];
  let currentMood = "";
  try {
    recs = await getStoredRecommendations();
    const profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: { currentMood: true },
    });
    currentMood = profile?.currentMood ?? "";
  } catch {
    // DB nicht konfiguriert
  }

  const hasSpotify = !!(session as any).accessToken;

  return (
    <RecommendationsView
      initialRecs={recs}
      hasSpotify={hasSpotify}
      initialMood={currentMood}
    />
  );
}
