import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InsightsView } from "@/components/InsightsView";

export default async function InsightsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  let feedbacks: any[] = [];
  let genreCounts: { genre: string | null; _count: { id: number } }[] = [];

  try {
    [feedbacks, genreCounts] = await Promise.all([
      prisma.feedback.findMany({
        where: { userId: session.user.id },
        include: {
          recommendation: {
            select: { genre: true, artistName: true, trackName: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.recommendation.groupBy({
        by: ["genre"],
        where: { userId: session.user.id },
        _count: { id: true },
      }),
    ]);
  } catch {
    // DB nicht erreichbar – leere Ansicht
  }

  return <InsightsView feedbacks={feedbacks} genreCounts={genreCounts} />;
}
