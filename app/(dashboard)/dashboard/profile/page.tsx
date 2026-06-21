import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileView } from "@/components/ProfileView";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
  });

  const hasSpotify = !!(session as any).accessToken;
  const feedbackStats = await prisma.feedback.groupBy({
    by: ["positive"],
    where: { userId: session.user.id },
    _count: { id: true },
  });

  return (
    <ProfileView
      profile={profile}
      hasSpotify={hasSpotify}
      feedbackStats={feedbackStats}
    />
  );
}
