"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Music2,
  Share2,
  Play,
  TrendingDown,
  X,
  Sparkles,
} from "lucide-react";
import { submitFeedback } from "@/actions/feedback";
import { ShareCard } from "@/components/ShareCard";

interface Rec {
  id: string;
  artistName: string;
  trackName?: string | null;
  albumName?: string | null;
  genre?: string | null;
  spotifyUrl?: string | null;
  soundcloudUrl?: string | null;
  coverUrl?: string | null;
  previewUrl?: string | null;
  popularity?: number | null;
  qualityScore?: number | null;
  undergroundScore?: number | null;
  reason?: string | null;
  tags?: string[] | string | null;
  scoreDetails?: {
    score?: number;
    quality?: number;
    underground?: number;
    popularity?: number | null;
    artistWeight?: number;
    genreWeight?: number;
    genrePreferred?: boolean;
    moodMatch?: boolean;
    source?: string;
  } | null;
  feedback?: {
    positive: boolean;
    rating?: number | null;
    reason?: string | null;
  } | null;
}

function parseTags(tags: any): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  if (typeof tags === "string") {
    try { return JSON.parse(tags); } catch { return []; }
  }
  return [];
}

const NEGATIVE_CATEGORIES: [string, string][] = [
  ["track-only", "Song passt nicht, Künstler ok"],
  ["wrong-genre", "Falsches Genre"],
  ["too-mainstream", "Zu mainstream"],
  ["already-known", "Kenne ich schon"],
];

const POSITIVE_CATEGORIES: [string, string][] = [
  ["genau-mein-sound", "Genau mein Sound"],
  ["starker-track", "Starker Track"],
  ["passt-zur-stimmung", "Passt zur Stimmung"],
  ["neue-entdeckung", "Tolle Entdeckung"],
];

export function RecommendationCard({
  rec,
  compact = false,
  onRated,
  onDismiss,
  onSimilar,
}: {
  rec: Rec;
  compact?: boolean;
  onRated?: (id: string, feedback: { positive: boolean; rating: number }) => void;
  onDismiss?: (id: string) => void;
  onSimilar?: (id: string) => void;
}) {
  const [feedback, setFeedback] = useState(rec.feedback ?? null);
  const [pendingRating, setPendingRating] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const tags = parseTags(rec.tags);
  const underground = tags.includes("underground-gem");

  const submitRating = async (rating: number, category?: string) => {
    setSubmitting(true);
    const result = await submitFeedback({
      recommendationId: rec.id,
      rating,
      category,
    });
    if (result.success) {
      setFeedback({ positive: rating >= 6, rating });
      onRated?.(rec.id, { positive: rating >= 6, rating });
    }
    setSubmitting(false);
    setPendingRating(null);
  };

  const handleRating = (rating: number) => {
    if (feedback || submitting) return;
    // Bei klaren Bewertungen kurz nachfragen, was (nicht) passt
    if (rating === 5) submitRating(rating);
    else setPendingRating(rating);
  };

  const ratingColor = (r: number) =>
    r >= 6 ? "text-[#1DB954]" : r <= 4 ? "text-red-400" : "text-white/60";

  const undergroundPct = Math.round((rec.undergroundScore ?? 0) * 100);
  const popularityPct = rec.popularity ?? 0;

  return (
    <>
      <article
        className={`
          glass rounded-2xl overflow-hidden glass-hover
          ${compact ? "p-0" : "p-0"}
          ${feedback?.positive === true ? "border-[#1DB954]/30" : ""}
          ${feedback?.positive === false ? "border-red-500/20" : ""}
          animate-fade-in
        `}
      >
        {/* Cover Image */}
        <div className="relative h-48 bg-surface-700 overflow-hidden">
          {rec.coverUrl ? (
            <Image
              src={rec.coverUrl}
              alt={rec.artistName}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music2 className="w-12 h-12 text-white/10" />
            </div>
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-transparent to-transparent" />

          {/* Underground badge */}
          {underground && (
            <div className="absolute top-3 left-3 underground-badge px-2.5 py-1 rounded-full text-xs font-semibold text-brand-200 flex items-center gap-1.5">
              <TrendingDown className="w-3 h-3" />
              Underground
            </div>
          )}

          {/* Preview play button */}
          {rec.previewUrl && (
            <a
              href={rec.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-brand-600/80 hover:bg-brand-500 flex items-center justify-center transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Play className="w-4 h-4 text-on-brand fill-on-brand" />
            </a>
          )}

          {/* Löschen – Empfehlung ausblenden und nie mehr vorschlagen */}
          {onDismiss && (
            <button
              onClick={() => onDismiss(rec.id)}
              title="Entfernen – wird nicht mehr vorgeschlagen"
              className={`absolute top-3 ${feedback ? "right-12" : "right-3"} w-7 h-7 rounded-full bg-surface-900/60 hover:bg-red-500/30 border border-white/10 hover:border-red-500/40 flex items-center justify-center text-white/50 hover:text-red-300 transition-colors z-10`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Feedback indicator */}
          {feedback && (
            <div
              className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center
                ${feedback.positive ? "bg-[#1DB954]/20 border border-[#1DB954]/40" : "bg-red-500/20 border border-red-500/40"}
              `}
            >
              {feedback.rating != null ? (
                <span
                  className={`text-xs font-bold ${ratingColor(feedback.rating)}`}
                >
                  {feedback.rating}
                </span>
              ) : feedback.positive ? (
                <ThumbsUp className="w-3.5 h-3.5 text-[#1DB954]" />
              ) : (
                <ThumbsDown className="w-3.5 h-3.5 text-red-400" />
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Genre- und Quellen-Tags */}
          <div className="flex flex-wrap gap-1.5 mb-2 empty:mb-0">
            {rec.genre && (
              <span className="inline-block px-2 py-0.5 rounded-md bg-brand-500/15 text-brand-300 text-xs font-medium">
                {rec.genre}
              </span>
            )}
            {tags.includes("aus-playlist") && (
              <span className="inline-block px-2 py-0.5 rounded-md bg-accent-teal/15 text-accent-teal text-xs font-medium">
                Playlist
              </span>
            )}
            {tags.includes("aus-bibliothek") && (
              <span className="inline-block px-2 py-0.5 rounded-md bg-accent-yellow/15 text-accent-yellow text-xs font-medium">
                Bibliothek
              </span>
            )}
          </div>

          <h3 className="font-semibold text-white text-base leading-snug mb-0.5">
            {rec.artistName}
          </h3>
          {rec.trackName && (
            <p className="text-white/50 text-sm truncate mb-1">
              {rec.trackName}
              {rec.albumName ? ` · ${rec.albumName}` : ""}
            </p>
          )}

          {/* Reason */}
          {rec.reason && !compact && (
            <p className="text-white/40 text-xs leading-relaxed mt-2 mb-2 line-clamp-2">
              {rec.reason}
            </p>
          )}

          {/* Warum diese Empfehlung? – Score-Aufschlüsselung */}
          {rec.scoreDetails && !compact && (
            <div className="mb-3">
              <button
                onClick={() => setShowWhy((v) => !v)}
                className="text-[11px] text-brand-300/60 hover:text-brand-300 transition-colors"
              >
                {showWhy ? "Details ausblenden ▴" : "Warum diese Empfehlung? ▾"}
              </button>
              {showWhy && (
                <ul className="mt-2 space-y-1 text-[11px] text-white/45 bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
                  {rec.scoreDetails.score != null && (
                    <li className="flex justify-between">
                      <span>Gesamt-Score</span>
                      <span className="text-brand-300 font-medium">
                        {rec.scoreDetails.score}/100
                      </span>
                    </li>
                  )}
                  {rec.scoreDetails.quality != null && (
                    <li className="flex justify-between">
                      <span>Qualität (45%)</span>
                      <span>{rec.scoreDetails.quality}%</span>
                    </li>
                  )}
                  {rec.scoreDetails.underground != null && (
                    <li className="flex justify-between">
                      <span>Underground (30%)</span>
                      <span>{rec.scoreDetails.underground}%</span>
                    </li>
                  )}
                  {rec.scoreDetails.moodMatch != null && (
                    <li className="flex justify-between">
                      <span>Stimmungs-Treffer (+12%)</span>
                      <span>{rec.scoreDetails.moodMatch ? "ja" : "–"}</span>
                    </li>
                  )}
                  {rec.scoreDetails.genrePreferred != null && (
                    <li className="flex justify-between">
                      <span>Bevorzugtes Genre (+8%)</span>
                      <span>{rec.scoreDetails.genrePreferred ? "ja" : "–"}</span>
                    </li>
                  )}
                  {rec.scoreDetails.artistWeight != null && (
                    <li className="flex justify-between">
                      <span>Künstler-Gewicht (Feedback)</span>
                      <span>{rec.scoreDetails.artistWeight.toFixed(2)}×</span>
                    </li>
                  )}
                  {rec.scoreDetails.genreWeight != null && (
                    <li className="flex justify-between">
                      <span>Genre-Gewicht (Feedback)</span>
                      <span>{rec.scoreDetails.genreWeight.toFixed(2)}×</span>
                    </li>
                  )}
                  {rec.scoreDetails.source && (
                    <li className="flex justify-between">
                      <span>Quelle</span>
                      <span>{rec.scoreDetails.source}</span>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          {/* Scores */}
          {!compact && (
            <div className="space-y-2 mb-4">
              <div>
                <div className="flex justify-between text-xs text-white/40 mb-1">
                  <span>Underground</span>
                  <span>{undergroundPct}%</span>
                </div>
                <div className="popularity-bar">
                  <div
                    className="popularity-fill bg-gradient-to-r from-brand-600 to-brand-400"
                    style={{ width: `${undergroundPct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-white/40 mb-1">
                  <span>Popularität</span>
                  <span>{popularityPct}/100</span>
                </div>
                <div className="popularity-bar">
                  <div
                    className="popularity-fill bg-gradient-to-r from-[#1DB954] to-accent-teal"
                    style={{ width: `${popularityPct}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bewertung 0–10 */}
          {!compact && !feedback && pendingRating == null && (
            <div className="mb-3">
              <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1.5">
                Bewertung (0–10)
              </p>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: 11 }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => handleRating(i)}
                    disabled={submitting}
                    className="w-6 h-6 rounded-md bg-white/5 border border-white/10 hover:bg-brand-600/40 hover:border-brand-500/50 text-white/50 hover:text-white text-[11px] font-medium transition-colors disabled:opacity-40"
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nachfrage bei klarer Bewertung */}
          {!compact && !feedback && pendingRating != null && (
            <div className="mb-3">
              <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1.5">
                Bewertung {pendingRating}/10 –{" "}
                {pendingRating <= 4 ? "was passt nicht?" : "was gefällt dir?"}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {(pendingRating <= 4
                  ? NEGATIVE_CATEGORIES
                  : POSITIVE_CATEGORIES
                ).map(([cat, label]) => (
                  <button
                    key={cat}
                    onClick={() => submitRating(pendingRating, cat)}
                    disabled={submitting}
                    className={`px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                      pendingRating <= 4
                        ? "hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-300"
                        : "hover:bg-[#1DB954]/15 hover:border-[#1DB954]/30 hover:text-[#1DB954]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => submitRating(pendingRating)}
                  disabled={submitting}
                  className="px-2.5 py-1 rounded-lg text-white/30 hover:text-white/60 text-[11px] transition-colors disabled:opacity-40"
                >
                  Überspringen
                </button>
              </div>
            </div>
          )}

          {!compact && feedback?.rating != null && (
            <p className={`text-xs font-medium mb-3 ${ratingColor(feedback.rating)}`}>
              Deine Bewertung: {feedback.rating}/10
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Ähnliche Empfehlungen zu gut Bewertetem */}
            {onSimilar && feedback?.positive && (
              <button
                onClick={() => onSimilar(rec.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/35 text-brand-300 text-xs font-medium transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                Ähnliches finden
              </button>
            )}

            {rec.spotifyUrl && (
              <a
                href={rec.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1DB954]/15 hover:bg-[#1DB954]/25 text-[#1DB954] text-xs font-medium transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Spotify
              </a>
            )}

            {!compact && (
              <button
                onClick={() => setShowShare(true)}
                className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </article>

      {showShare && (
        <ShareCard
          rec={rec}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}
