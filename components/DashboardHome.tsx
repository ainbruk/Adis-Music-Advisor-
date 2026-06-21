"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  Music2,
  TrendingUp,
  ThumbsUp,
  Zap,
  ArrowRight,
  Sparkles,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { RecommendationCard } from "@/components/RecommendationCard";

interface Props {
  user: { name?: string | null; image?: string | null };
  profile: any;
  recentRecs: any[];
  feedbackCount: number;
  positiveCount: number;
  hasSpotify: boolean;
}

export function DashboardHome({
  user,
  profile,
  recentRecs,
  feedbackCount,
  positiveCount,
  hasSpotify,
}: Props) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";

  const topArtists = (profile?.topArtists ?? []) as string[];
  const mood = profile?.currentMood;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <p className="text-white/40 text-sm mb-1">{greeting}</p>
        <h1 className="text-3xl font-bold text-white">
          {user.name?.split(" ")[0] ?? "Musiker"}
        </h1>
        {mood && (
          <p className="mt-2 text-brand-300/80 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Aktuelle Stimmung: <em>"{mood}"</em>
          </p>
        )}
      </div>

      {/* Spotify Connect Banner */}
      {!hasSpotify && (
        <div className="mb-8 rounded-2xl border border-[#1DB954]/30 bg-[#1DB954]/5 p-5 flex items-center gap-4">
          <AlertCircle className="w-5 h-5 text-[#1DB954] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white/80 text-sm font-medium">
              Verbinde Spotify für personalisierte Empfehlungen
            </p>
            <p className="text-white/40 text-xs mt-0.5">
              Ohne Spotify-Verbindung werden kuratierte Defaults angezeigt.
            </p>
          </div>
          <button
            onClick={() => signIn("spotify", { callbackUrl: "/dashboard" })}
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-[#1DB954] text-black text-sm font-bold hover:bg-[#1ed760] transition-colors"
          >
            Verbinden
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: Music2,
            label: "Top-Künstler",
            value: topArtists.length,
            color: "text-brand-400",
            bg: "bg-brand-500/10",
          },
          {
            icon: Zap,
            label: "Empfehlungen",
            value: recentRecs.length,
            color: "text-accent-teal",
            bg: "bg-accent-teal/10",
          },
          {
            icon: ThumbsUp,
            label: "Positives Feedback",
            value: positiveCount,
            color: "text-[#1DB954]",
            bg: "bg-[#1DB954]/10",
          },
          {
            icon: BarChart3,
            label: "Gesamt-Feedback",
            value: feedbackCount,
            color: "text-accent-coral",
            bg: "bg-accent-coral/10",
          },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="glass rounded-2xl p-5">
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-white/40 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-2 gap-4 mb-10">
        <Link
          href="/dashboard/recommendations"
          className="glass glass-hover rounded-2xl p-6 flex items-center gap-4 group"
        >
          <div className="w-12 h-12 bg-brand-600/20 rounded-2xl flex items-center justify-center group-hover:bg-brand-600/30 transition-colors">
            <Sparkles className="w-6 h-6 text-brand-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">Empfehlungen generieren</p>
            <p className="text-white/40 text-sm mt-0.5">
              Neue Underground-Perlen entdecken
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-brand-400 transition-colors" />
        </Link>

        <Link
          href="/dashboard/profile"
          className="glass glass-hover rounded-2xl p-6 flex items-center gap-4 group"
        >
          <div className="w-12 h-12 bg-accent-coral/10 rounded-2xl flex items-center justify-center group-hover:bg-accent-coral/20 transition-colors">
            <TrendingUp className="w-6 h-6 text-accent-coral" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">Profil verfeinern</p>
            <p className="text-white/40 text-sm mt-0.5">
              Stimmung, Genres und Top-Listen bearbeiten
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-accent-coral transition-colors" />
        </Link>
      </div>

      {/* Recent Recommendations */}
      {recentRecs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">
              Letzte Empfehlungen
            </h2>
            <Link
              href="/dashboard/recommendations"
              className="text-brand-400 text-sm hover:text-brand-300 flex items-center gap-1"
            >
              Alle anzeigen <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentRecs.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
