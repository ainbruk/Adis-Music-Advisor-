import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HistoryView } from "@/components/HistoryView";

export default async function HistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  let feedbacks: any[] = [];
  try {
    feedbacks = await prisma.feedback.findMany({
      where: { userId: session.user.id },
      include: { recommendation: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  } catch {
    // DB nicht erreichbar – leeren Verlauf anzeigen
  }

  return <HistoryView feedbacks={feedbacks} />;
}
