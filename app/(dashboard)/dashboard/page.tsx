import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardHome } from "@/components/DashboardHome";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const [profile, recentRecs, feedbackCount] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.recommendation.findMany({
      where: { userId: session.user.id },
      include: { feedback: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.feedback.count({ where: { userId: session.user.id } }),
  ]);

  const positiveCount = await prisma.feedback.count({
    where: { userId: session.user.id, positive: true },
  });

  return (
    <DashboardHome
      user={session.user}
      profile={profile}
      recentRecs={recentRecs}
      feedbackCount={feedbackCount}
      positiveCount={positiveCount}
      hasSpotify={!!(session as any).accessToken}
    />
  );
}
