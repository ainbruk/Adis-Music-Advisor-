"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FeedbackSchema = z.object({
  recommendationId: z.string().min(1),
  positive: z.boolean(),
  reason: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
});

const POSITIVE_WEIGHT = 1.3;
const NEGATIVE_WEIGHT = 0.6;
const ADJUSTMENT_STEP = 0.15;

export async function submitFeedback(data: z.infer<typeof FeedbackSchema>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return { success: false, error: "Nicht authentifiziert" };

  const parsed = FeedbackSchema.safeParse(data);
  if (!parsed.success)
    return { success: false, error: parsed.error.message };

  const { recommendationId, positive, reason, category } = parsed.data;
  const userId = session.user.id;

  const recommendation = await prisma.recommendation.findUnique({
    where: { id: recommendationId, userId },
  });
  if (!recommendation)
    return { success: false, error: "Empfehlung nicht gefunden" };

  await prisma.feedback.upsert({
    where: { recommendationId },
    update: { positive, reason, category },
    create: { recommendationId, userId, positive, reason, category },
  });

  // Adjust artist and genre weights in the profile
  const profile = await prisma.userProfile.findUnique({ where: { userId } });

  const artistWeights = ((profile?.artistWeights ?? {}) as Record<string, number>);
  const genreWeights = ((profile?.genreWeights ?? {}) as Record<string, number>);

  const artistKey = recommendation.spotifyId ?? recommendation.artistName;
  const genreKey = recommendation.genre ?? "";

  const currentArtistWeight = artistWeights[artistKey] ?? 1.0;
  const currentGenreWeight = genreWeights[genreKey] ?? 1.0;

  if (positive) {
    artistWeights[artistKey] = Math.min(
      2.0,
      currentArtistWeight + ADJUSTMENT_STEP
    );
    if (genreKey)
      genreWeights[genreKey] = Math.min(
        2.0,
        currentGenreWeight + ADJUSTMENT_STEP * 0.5
      );
  } else {
    artistWeights[artistKey] = Math.max(
      0.1,
      currentArtistWeight - ADJUSTMENT_STEP
    );
    if (genreKey)
      genreWeights[genreKey] = Math.max(
        0.2,
        currentGenreWeight - ADJUSTMENT_STEP * 0.3
      );
  }

  await prisma.userProfile.upsert({
    where: { userId },
    update: { artistWeights, genreWeights, updatedAt: new Date() },
    create: { userId, artistWeights, genreWeights },
  });

  revalidatePath("/dashboard");
  return { success: true };
}

export async function getFeedbackStats(userId: string) {
  const feedbacks = await prisma.feedback.findMany({
    where: { userId },
    include: { recommendation: true },
  });

  const total = feedbacks.length;
  const positive = feedbacks.filter((f) => f.positive).length;
  const negative = total - positive;

  const genreBreakdown: Record<string, { positive: number; negative: number }> = {};
  for (const f of feedbacks) {
    const genre = f.recommendation.genre ?? "Unknown";
    if (!genreBreakdown[genre]) genreBreakdown[genre] = { positive: 0, negative: 0 };
    if (f.positive) genreBreakdown[genre].positive++;
    else genreBreakdown[genre].negative++;
  }

  return { total, positive, negative, genreBreakdown };
}
