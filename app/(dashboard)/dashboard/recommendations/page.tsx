import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStoredRecommendations } from "@/actions/recommendations";
import { RecommendationsView } from "@/components/RecommendationsView";

export default async function RecommendationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  let recs: any[] = [];
  try {
    recs = await getStoredRecommendations();
  } catch {
    // DB nicht konfiguriert
  }

  const hasSpotify = !!(session as any).accessToken;

  return <RecommendationsView initialRecs={recs} hasSpotify={hasSpotify} />;
}
