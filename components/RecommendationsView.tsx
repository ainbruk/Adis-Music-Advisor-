"use client";

import { useState, useTransition } from "react";
import {
  Sparkles,
  RefreshCw,
  Filter,
  Music2,
  History,
  Heart,
  BookmarkX,
} from "lucide-react";
import { generateRecommendations } from "@/actions/recommendations";
import { updateProfile } from "@/actions/profile";
import { RecommendationCard } from "@/components/RecommendationCard";

interface Props {
  initialRecs: any[];
  hasSpotify: boolean;
  initialMood?: string;
}

const MOODS = [
  "Melancholisch",
  "Verträumt",
  "Nachdenklich",
  "Ruhig",
  "Dunkel",
  "Energisch",
  "Groovy",
  "Euphorisch",
];

export function RecommendationsView({
  initialRecs,
  hasSpotify,
  initialMood = "",
}: Props) {
  const [recs, setRecs] = useState(initialRecs);
  const [activeGenre, setActiveGenre] = useState("Alle");
  const [mood, setMood] = useState(initialMood);
  const [excludeSaved, setExcludeSaved] = useState(true);
  // IDs der zuletzt generierten Empfehlungen – für die Trennung neu/früher
  const [latestIds, setLatestIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Filter-Chips dynamisch aus den vorhandenen Empfehlungen ableiten
  const genreCounts = new Map<string, number>();
  for (const r of recs) {
    const g = r.genre?.toLowerCase();
    if (g) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
  }
  const genreOptions = [
    "Alle",
    ...Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g)
      .slice(0, 14),
  ];

  // Falls das aktive Genre nach einer Neugenerierung nicht mehr vorkommt
  const effectiveGenre =
    activeGenre !== "Alle" && !genreCounts.has(activeGenre)
      ? "Alle"
      : activeGenre;

  const runGeneration = async () => {
    const result = await generateRecommendations(12, { excludeSaved });
    if (result.success) {
      const newIds = new Set<string>(result.items.map((r: any) => r.id));
      setLatestIds(newIds);
      setRecs((prev) => {
        const merged = [
          ...result.items,
          ...prev.filter((r) => !newIds.has(r.id)),
        ];
        return merged.slice(0, 24);
      });
    } else {
      setError(result.error ?? "Fehler bei der Generierung");
    }
  };

  const handleGenerate = () => {
    setError("");
    startTransition(runGeneration);
  };

  // Stimmung wählen → speichern → direkt passende Empfehlungen generieren
  const selectMood = (m: string) => {
    const next = mood === m ? "" : m;
    setMood(next);
    setError("");
    startTransition(async () => {
      await updateProfile({ currentMood: next });
      if (next) await runGeneration();
    });
  };

  const filtered =
    effectiveGenre === "Alle"
      ? recs
      : recs.filter((r) => r.genre?.toLowerCase() === effectiveGenre);

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

      {/* Bibliothek-Filter – steuert die nächste Generierung */}
      <div className="flex gap-2 flex-wrap mb-4">
        <BookmarkX className="w-4 h-4 text-white/30 self-center" />
        <button
          onClick={() => setExcludeSaved((v) => !v)}
          disabled={isPending}
          title="Gefolgte Künstler und Künstler deiner gespeicherten Songs ausschliessen"
          className={`
            px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border disabled:opacity-50
            ${
              excludeSaved
                ? "bg-accent-teal/15 border-accent-teal/40 text-accent-teal"
                : "bg-white/5 border-white/10 text-white/45 hover:text-white/70 hover:border-white/20"
            }
          `}
        >
          {excludeSaved
            ? "Ohne gespeicherte Künstler ✓"
            : "Gespeicherte Künstler erlaubt"}
        </button>
      </div>

      {/* Stimmung – steuert die nächste Generierung */}
      <div className="flex gap-2 flex-wrap mb-4">
        <Heart className="w-4 h-4 text-white/30 self-center" />
        {MOODS.map((m) => (
          <button
            key={m}
            onClick={() => selectMood(m)}
            disabled={isPending}
            className={`
              px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border disabled:opacity-50
              ${
                mood === m
                  ? "bg-accent-pink/20 border-accent-pink/40 text-accent-pink"
                  : "bg-white/5 border-white/10 text-white/45 hover:text-white/70 hover:border-white/20"
              }
            `}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Genre Filter – zeigt die Genres der aktuellen Empfehlungen */}
      {genreOptions.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-6">
          <Filter className="w-4 h-4 text-white/30 self-center" />
          {genreOptions.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGenre(g)}
              className={`
                px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border
                ${
                  effectiveGenre === g
                    ? "bg-brand-600/30 border-brand-500/50 text-brand-200"
                    : "bg-white/5 border-white/10 text-white/45 hover:text-white/70 hover:border-white/20"
                }
              `}
            >
              {g}
              {g !== "Alle" && (
                <span className="ml-1.5 text-white/30">{genreCounts.get(g)}</span>
              )}
            </button>
          ))}
        </div>
      )}

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

      {/* Grid – neueste Generierung getrennt von früheren Empfehlungen */}
      {filtered.length > 0 && (
        <>
          {filtered.some((r) => latestIds.has(r.id)) && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-brand-400" />
                Neu generiert
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered
                  .filter((r) => latestIds.has(r.id))
                  .map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} />
                  ))}
              </div>
            </section>
          )}

          {filtered.some((r) => !latestIds.has(r.id)) && (
            <section>
              <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-white/30" />
                {latestIds.size > 0 ? "Frühere Empfehlungen" : "Empfehlungen"}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered
                  .filter((r) => !latestIds.has(r.id))
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
