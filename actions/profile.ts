"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ProfileSchema = z.object({
  currentMood: z.string().max(500).optional(),
  aestheticText: z.string().max(1000).optional(),
  popularityThreshold: z.number().int().min(20).max(100).optional(),
  topArtists: z.array(z.string()).max(100).optional(),
  topTracks: z.array(z.string()).max(50).optional(),
  soundcloudUsername: z.string().max(100).optional(),
  genrePreferences: z.record(z.string(), z.number()).optional(),
});

export type ProfileFormData = z.infer<typeof ProfileSchema>;

export async function getUserProfile() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return prisma.userProfile.findUnique({
    where: { userId: session.user.id },
  });
}

export async function updateProfile(data: ProfileFormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Nicht authentifiziert" };

  const parsed = ProfileSchema.safeParse(data);
  if (!parsed.success)
    return { success: false, error: "Ungültige Daten: " + parsed.error.message };

  await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    update: {
      ...parsed.data,
      updatedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      ...parsed.data,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  return { success: true };
}

export async function importSpotifyTopArtists(artists: { id: string; name: string }[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Nicht authentifiziert" };

  const artistNames = artists.map((a) => a.name);

  await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    update: {
      topArtists: artistNames,
      spotifyConnected: true,
      updatedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      topArtists: artistNames,
      spotifyConnected: true,
    },
  });

  revalidatePath("/dashboard/profile");
  return { success: true, imported: artistNames.length };
}
