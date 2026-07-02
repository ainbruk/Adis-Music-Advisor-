"use client";

import { useState } from "react";
import Image from "next/image";
import {
  History,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Music2,
} from "lucide-react";

interface FeedbackEntry {
  id: string;
  positive: boolean;
  reason?: string | null;
  category?: string | null;
  createdAt: string | Date;
  recommendation: {
    artistName: string;
    trackName?: string | null;
    genre?: string | null;
    coverUrl?: string | null;
    spotifyUrl?: string | null;
  };
}

type FilterMode = "alle" | "positiv" | "negativ";

function formatDay(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Heute";
  if (sameDay(date, yesterday)) return "Gestern";
  return date.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function HistoryView({ feedbacks }: { feedbacks: FeedbackEntry[] }) {
  const [filter, setFilter] = useState<FilterMode>("alle");

  const filtered = feedbacks.filter((f) =>
    filter === "alle" ? true : filter === "positiv" ? f.positive : !f.positive
  );

  // Nach Tag gruppieren (Einträge kommen bereits absteigend sortiert)
  const groups: { day: string; entries: FeedbackEntry[] }[] = [];
  for (const f of filtered) {
    const day = formatDay(new Date(f.createdAt));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.entries.push(f);
    else groups.push({ day, entries: [f] });
  }

  const posCount = feedbacks.filter((f) => f.positive).length;
  const negCount = feedbacks.length - posCount;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Verlauf</h1>
        <p className="text-white/40 text-sm">
          {feedbacks.length} Bewertungen ·{" "}
          <span className="text-[#1DB954]">{posCount} positiv</span> ·{" "}
          <span className="text-red-400">{negCount} negativ</span>
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-8">
        {(
          [
            ["alle", "Alle"],
            ["positiv", "Positiv"],
            ["negativ", "Negativ"],
          ] as [FilterMode, string][]
        ).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            className={`
              px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border
              ${
                filter === mode
                  ? "bg-brand-600/30 border-brand-500/50 text-brand-200"
                  : "bg-white/5 border-white/10 text-white/45 hover:text-white/70 hover:border-white/20"
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
            <History className="w-8 h-8 text-brand-400/50" />
          </div>
          <h3 className="text-white/60 font-medium mb-2">Noch keine Bewertungen</h3>
          <p className="text-white/30 text-sm max-w-xs">
            Bewerte Empfehlungen mit «Trifft zu» oder «Passt nicht» – hier
            erscheint dann dein kompletter Verlauf.
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-8">
        {groups.map(({ day, entries }) => (
          <section key={day}>
            <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
              {day}
            </h2>
            <div className="space-y-2">
              {entries.map((f) => {
                const rec = f.recommendation;
                const time = new Date(f.createdAt).toLocaleTimeString("de-CH", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={f.id}
                    className="glass rounded-xl p-3.5 flex items-center gap-3.5"
                  >
                    {/* Cover */}
                    <div className="relative w-11 h-11 rounded-lg bg-surface-700 overflow-hidden flex-shrink-0">
                      {rec.coverUrl ? (
                        <Image
                          src={rec.coverUrl}
                          alt={rec.artistName}
                          fill
                          className="object-cover"
                          sizes="44px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music2 className="w-5 h-5 text-white/15" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-white/85 text-sm font-medium truncate">
                        {rec.artistName}
                        {rec.trackName && (
                          <span className="text-white/40 font-normal">
                            {" "}· {rec.trackName}
                          </span>
                        )}
                      </p>
                      <p className="text-white/30 text-xs truncate">
                        {time} Uhr
                        {rec.genre ? ` · ${rec.genre}` : ""}
                        {f.reason ? ` · «${f.reason}»` : ""}
                      </p>
                    </div>

                    {/* Bewertung */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                        ${
                          f.positive
                            ? "bg-[#1DB954]/15 border border-[#1DB954]/30"
                            : "bg-red-500/15 border border-red-500/30"
                        }
                      `}
                    >
                      {f.positive ? (
                        <ThumbsUp className="w-3.5 h-3.5 text-[#1DB954]" />
                      ) : (
                        <ThumbsDown className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </div>

                    {rec.spotifyUrl && (
                      <a
                        href={rec.spotifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-[#1DB954]/15 text-white/30 hover:text-[#1DB954] transition-colors flex-shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
