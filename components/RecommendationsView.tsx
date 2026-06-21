"use client";

import { useState, useTransition } from "react";
import { Sparkles, RefreshCw, Filter, Music2, TrendingDown } from "lucide-react";
import { generateRecommendations } from "@/actions/recommendations";
import { RecommendationCard } from "@/components/RecommendationCard";

interface Props {
  initialRecs: any[];
  hasSpotify: boolean;
}

const GENRES = [
  "Alle",
  "ambient",
  "experimental",
  "deep house",
  "melodic techno",
  "post-rock",
  "shoegaze",
  "neo-soul",
  "drone",
  "darkwave",
];

export function RecommendationsView({ initialRecs, hasSpotify }: Props) {
  const [recs, setRecs] = useState(initialRecs);
  const [activeGenre, setActiveGenre] = useState("Alle");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleGenerate = () => {
    setError("");
    startTransition(async () => {
      const result = await generateRecommendations(12);
      if (result.success) {
        setRecs((prev) => {
          const newIds = new Set(result.items.map((r: any) => r.id));
          const merged = [
            ...result.items,
            ...prev.filter((r) => !newIds.has(r.id)),
          ];
          return merged.slice(0, 24);
        });
      } else {
        setError(result.error ?? "Fehler bei der Generierung");
      }
    });
  };

  const filtered =
    activeGenre === "Alle"
      ? recs
      : recs.filter(
          (r) => r.genre?.toLowerCase().includes(activeGenre.toLowerCase())
        );

  const undergroundCount = recs.filter((r) => {
    const tags = Array.isArray(r.tags) ? r.tags : [];
    return tags.includes("underground-gem");
  }).length;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Empfehlungen</h1>
          <p className="text-white/40 text-sm">
            {recs.length} Empfehlungen ·{" "}
            <span className="text-brand-400">{undergroundCount} Underground-Perlen</span>
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all disabled:opacity-60 glow-purple"
        >
          {isPending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {isPending ? "Generiere..." : "Neue Empfehlungen"}
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Genre Filter */}
      <div className="flex gap-2 flex-wrap mb-6">
        <Filter className="w-4 h-4 text-white/30 self-center" />
        {GENRES.map((g) => (
          <button
            key={g}
            onClick={() => setActiveGenre(g)}
            className={`
              px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border
              ${
                activeGenre === g
                  ? "bg-brand-600/30 border-brand-500/50 text-brand-200"
                  : "bg-white/5 border-white/10 text-white/45 hover:text-white/70 hover:border-white/20"
              }
            `}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
            <Music2 className="w-8 h-8 text-brand-400/50" />
          </div>
          <h3 className="text-white/60 font-medium mb-2">Noch keine Empfehlungen</h3>
          <p className="text-white/30 text-sm max-w-xs mb-6">
            {hasSpotify
              ? "Klicke auf 'Neue Empfehlungen', um deinen personalisierten Feed zu generieren."
              : "Verbinde Spotify oder klicke auf 'Neue Empfehlungen' für kuratierte Defaults."}
          </p>
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all disabled:opacity-60"
          >
            {isPending ? "Generiere..." : "Jetzt starten"}
          </button>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <>
          {/* Underground section */}
          {filtered.some((r) => {
            const tags = Array.isArray(r.tags) ? r.tags : [];
            return tags.includes("underground-gem");
          }) && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2 mb-4">
                <TrendingDown className="w-4 h-4 text-brand-400" />
                Underground-Perlen
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered
                  .filter((r) => {
                    const tags = Array.isArray(r.tags) ? r.tags : [];
                    return tags.includes("underground-gem");
                  })
                  .map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} />
                  ))}
              </div>
            </section>
          )}

          {/* All other recommendations */}
          {filtered.some((r) => {
            const tags = Array.isArray(r.tags) ? r.tags : [];
            return !tags.includes("underground-gem");
          }) && (
            <section>
              <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">
                Weitere Empfehlungen
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered
                  .filter((r) => {
                    const tags = Array.isArray(r.tags) ? r.tags : [];
                    return !tags.includes("underground-gem");
                  })
                  .map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} />
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
