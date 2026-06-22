import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import SpotifyProvider from "next-auth/providers/spotify";
import { prisma } from "@/lib/prisma";

// NEXTAUTH_URL automatisch aus VERCEL_URL ableiten wenn nicht gesetzt
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-library-read",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-recently-played",
].join(" ");

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
      authorization: {
        params: { scope: SPOTIFY_SCOPES },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        try {
          const account = await prisma.account.findFirst({
            where: { userId: user.id, provider: "spotify" },
          });
          if (account?.access_token) {
            (session as any).accessToken = account.access_token;
            (session as any).refreshToken = account.refresh_token;
            (session as any).expiresAt = account.expires_at;
          }
        } catch {
          // DB nicht erreichbar – Session ohne Token zurückgeben
        }
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      try {
        const existing = await prisma.userProfile.findUnique({
          where: { userId: user.id },
        });
        if (!existing) {
          await prisma.userProfile.create({
            data: { userId: user.id, spotifyConnected: true },
          });
        }
      } catch {
        // Profil-Erstellung konnte nicht gespeichert werden
      }
    },
  },
  pages: {
    signIn: "/",
    error: "/auth-error",
  },
  session: {
    strategy: "database",
  },
  secret: process.env.NEXTAUTH_SECRET ?? "dev-secret-please-change-in-production",
};
