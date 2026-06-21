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
} from "lucide-react";
import { submitFeedback } from "@/actions/feedback";
import { FeedbackPanel } from "@/components/FeedbackPanel";
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
  feedback?: { positive: boolean; reason?: string | null } | null;
}

function parseTags(tags: any): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  if (typeof tags === "string") {
    try { return JSON.parse(tags); } catch { return []; }
  }
  return [];
}

export function RecommendationCard({
  rec,
  compact = false,
}: {
  rec: Rec;
  compact?: boolean;
}) {
  const [feedback, setFeedback] = useState(rec.feedback ?? null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const tags = parseTags(rec.tags);
  const underground = tags.includes("underground-gem");

  const handleQuickFeedback = async (positive: boolean) => {
    if (feedback || submitting) return;
    setSubmitting(true);
    const result = await submitFeedback({ recommendationId: rec.id, positive });
    if (result.success) setFeedback({ positive });
    setSubmitting(false);
  };

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
              <Play className="w-4 h-4 text-white fill-white" />
            </a>
          )}

          {/* Feedback indicator */}
          {feedback && (
            <div
              className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center
                ${feedback.positive ? "bg-[#1DB954]/20 border border-[#1DB954]/40" : "bg-red-500/20 border border-red-500/40"}
              `}
            >
              {feedback.positive ? (
                <ThumbsUp className="w-3.5 h-3.5 text-[#1DB954]" />
              ) : (
                <ThumbsDown className="w-3.5 h-3.5 text-red-400" />
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Genre tag */}
          {rec.genre && (
            <span className="inline-block px-2 py-0.5 rounded-md bg-brand-500/15 text-brand-300 text-xs font-medium mb-2">
              {rec.genre}
            </span>
          )}

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
            <p className="text-white/40 text-xs leading-relaxed mt-2 mb-3 line-clamp-2">
              {rec.reason}
            </p>
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

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
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
              <>
                <button
                  onClick={() => handleQuickFeedback(true)}
                  disabled={!!feedback || submitting}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${
                      feedback?.positive === true
                        ? "bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30"
                        : "bg-white/5 hover:bg-[#1DB954]/10 text-white/50 hover:text-[#1DB954] disabled:opacity-40"
                    }
                  `}
                >
                  <ThumbsUp className="w-3 h-3" />
                  Trifft zu
                </button>

                <button
                  onClick={() => setShowFeedback(true)}
                  disabled={!!feedback || submitting}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${
                      feedback?.positive === false
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-white/5 hover:bg-red-500/10 text-white/50 hover:text-red-400 disabled:opacity-40"
                    }
                  `}
                >
                  <ThumbsDown className="w-3 h-3" />
                  Passt nicht
                </button>

                <button
                  onClick={() => setShowShare(true)}
                  className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </article>

      {showFeedback && (
        <FeedbackPanel
          recommendationId={rec.id}
          artistName={rec.artistName}
          onClose={() => setShowFeedback(false)}
          onSubmit={(result) => {
            setFeedback({ positive: false, reason: result.reason });
            setShowFeedback(false);
          }}
        />
      )}

      {showShare && (
        <ShareCard
          rec={rec}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}
