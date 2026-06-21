import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileView } from "@/components/ProfileView";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  let profile = null;
  let feedbackStats: any[] = [];

  try {
    [profile, feedbackStats] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId: session.user.id } }),
      prisma.feedback.groupBy({
        by: ["positive"],
        where: { userId: session.user.id },
        _count: { id: true },
      }),
    ]);
  } catch {
    // DB nicht konfiguriert
  }

  return (
    <ProfileView
      profile={profile}
      hasSpotify={!!(session as any).accessToken}
      feedbackStats={feedbackStats}
    />
  );
}
