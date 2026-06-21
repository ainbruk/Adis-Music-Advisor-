"use client";

import { useRef, useState } from "react";
import { X, Download, Copy, Check, Music2, TrendingDown } from "lucide-react";

interface Rec {
  artistName: string;
  trackName?: string | null;
  genre?: string | null;
  coverUrl?: string | null;
  undergroundScore?: number | null;
  reason?: string | null;
  tags?: any;
}

function parseTags(tags: any): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  if (typeof tags === "string") {
    try { return JSON.parse(tags); } catch { return []; }
  }
  return [];
}

export function ShareCard({ rec, onClose }: { rec: Rec; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const tags = parseTags(rec.tags);
  const underground = tags.includes("underground-gem");
  const undergroundPct = Math.round((rec.undergroundScore ?? 0) * 100);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: "#12121a",
      scale: 2,
    });
    const link = document.createElement("a");
    link.download = `curatedvibe-${rec.artistName.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleCopyText = () => {
    const text = `🎵 CuratedVibe Empfehlung\n\n${rec.artistName}${rec.trackName ? ` – ${rec.trackName}` : ""}\n${rec.genre ? `Genre: ${rec.genre}\n` : ""}${rec.reason ? `\n${rec.reason}` : ""}\n\nEntdeckt via CuratedVibe`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Shareable card preview */}
        <div
          ref={cardRef}
          className="rounded-2xl overflow-hidden bg-surface-800 border border-brand-500/20"
          style={{
            background: "linear-gradient(135deg, #12121a 0%, #1a1a26 100%)",
          }}
        >
          {/* Top accent line */}
          <div className="h-1 bg-gradient-to-r from-brand-600 via-accent-pink to-accent-coral" />

          <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-5">
              <div className="w-6 h-6 bg-brand-600 rounded-md flex items-center justify-center">
                <Music2 className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-xs font-bold text-brand-300 tracking-wider uppercase">
                CuratedVibe
              </span>
              {underground && (
                <span className="ml-auto underground-badge px-2 py-0.5 rounded-full text-xs text-brand-200 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  Underground
                </span>
              )}
            </div>

            {/* Cover + Info */}
            <div className="flex gap-4 mb-5">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-surface-700 flex-shrink-0 flex items-center justify-center">
                {rec.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rec.coverUrl}
                    alt={rec.artistName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music2 className="w-8 h-8 text-white/20" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-white text-lg leading-snug">
                  {rec.artistName}
                </h3>
                {rec.trackName && (
                  <p className="text-white/50 text-sm mt-0.5 truncate">
                    {rec.trackName}
                  </p>
                )}
                {rec.genre && (
                  <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-brand-500/20 text-brand-300 text-xs">
                    {rec.genre}
                  </span>
                )}
              </div>
            </div>

            {/* Underground score */}
            {undergroundPct > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-white/40 mb-1.5">
                  <span>Underground-Score</span>
                  <span className="text-brand-300 font-medium">{undergroundPct}%</span>
                </div>
                <div className="popularity-bar">
                  <div
                    className="popularity-fill bg-gradient-to-r from-brand-600 to-accent-pink"
                    style={{ width: `${undergroundPct}%` }}
                  />
                </div>
              </div>
            )}

            {rec.reason && (
              <p className="text-white/40 text-xs leading-relaxed italic">
                "{rec.reason}"
              </p>
            )}

            {/* Footer */}
            <div className="mt-5 pt-4 border-t border-white/5">
              <p className="text-white/20 text-xs">curatedvibe.app</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <button
            onClick={handleCopyText}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass hover:bg-white/10 text-white/70 text-sm font-medium transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#1DB954]" />
                Kopiert!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Text kopieren
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Bild speichern
          </button>
        </div>
      </div>
    </div>
  );
}
