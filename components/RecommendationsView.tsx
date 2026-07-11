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
  Archive,
  ChevronDown,
  ChevronRight,
  ListMusic,
} from "lucide-react";
import {
  generateRecommendations,
  generateSimilarRecommendations,
  generateFromPlaylist,
  dismissRecommendation,
} from "@/actions/recommendations";
import { updateProfile } from "@/actions/profile";
import { RecommendationCard } from "@/components/RecommendationCard";

interface Props {
  initialRecs: any[];
  hasSpotify: boolean;
  initialMood?: string;
  playlists?: { id: string; name: string }[];
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
  playlists = [],
}: Props) {
  const [recs, setRecs] = useState(initialRecs);
  const [activeGenre, setActiveGenre] = useState("Alle");
  const [mood, setMood] = useState(initialMood);
  const [moodText, setMoodText] = useState(
    MOODS.includes(initialMood) ? "" : initialMood
  );
  const [selectedPlaylist, setSelectedPlaylist] = useState("");
  const [noResult, setNoResult] = useState<{
    genres: string[];
    threshold: number;
  } | null>(null);
  const [excludeSaved, setExcludeSaved] = useState(true);
  // IDs der zuletzt generierten Empfehlungen – für die Trennung neu/früher
  const [latestIds, setLatestIds] = useState<Set<string>>(new Set());
  const [showArchive, setShowArchive] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Karte entfernen (bleibt in der DB gesperrt)
  const handleDismiss = (id: string) => {
    setRecs((prev) => prev.filter((r) => r.id !== id));
    dismissRecommendation(id);
  };

  // Nach Bewertung wandert die Karte ins Archiv
  const handleRated = (
    id: string,
    fb: { positive: boolean; rating: number }
  ) => {
    setRecs((prev) =>
      prev.map((r) => (r.id === id ? { ...r, feedback: fb } : r))
    );
  };

  // Bewertete Empfehlungen wandern ins Archiv
  const active = recs.filter((r) => !r.feedback);
  const archived = recs.filter((r) => r.feedback);

  // Filter-Chips dynamisch aus den aktiven Empfehlungen ableiten
  const genreCounts = new Map<string, number>();
  for (const r of active) {
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

  const mergeResults = (result: {
    success: boolean;
    items: any[];
    error?: string;
    searchedGenres?: string[];
    threshold?: number;
  }) => {
    setNoResult(null);
    if (result.success) {
      const newIds = new Set<string>(result.items.map((r: any) => r.id));
      setLatestIds(newIds);
      setRecs((prev) => {
        const merged = [
          ...result.items,
          ...prev.filter((r) => !newIds.has(r.id)),
        ];
        return merged.slice(0, 48);
      });
    } else if (result.searchedGenres && result.threshold != null) {
      // Erklärung + Filter-Vorschlag statt nur einer Fehlermeldung
      setNoResult({ genres: result.searchedGenres, threshold: result.threshold });
    } else {
      setError(result.error ?? "Fehler bei der Generierung");
    }
  };

  const runGeneration = async () => {
    mergeResults(await generateRecommendations(12, { excludeSaved }));
  };

  // Ähnliche Empfehlungen zu einer gut bewerteten Karte holen
  const handleSimilar = (id: string) => {
    setError("");
    startTransition(async () => {
      mergeResults(await generateSimilarRecommendations(id));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  // Freitext-Stimmung: sofort speichern und passende Empfehlungen holen
  const submitMoodText = () => {
    const text = moodText.trim();
    if (!text || isPending) return;
    setMood("");
    setError("");
    startTransition(async () => {
      await updateProfile({ currentMood: text });
      await runGeneration();
    });
  };

  // Gewählte Playlist gezielt durchsuchen
  const handleFromPlaylist = () => {
    const pl = playlists.find((p) => p.id === selectedPlaylist);
    if (!pl || isPending) return;
    setError("");
    startTransition(async () => {
      mergeResults(await generateFromPlaylist(pl.id, pl.name));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  // "Nichts gefunden": Popularity-Filter lockern und direkt neu suchen
  const relaxFilterAndRetry = () => {
    if (!noResult || isPending) return;
    const next = Math.min(100, noResult.threshold + 10);
    setError("");
    startTransition(async () => {
      await updateProfile({ popularityThreshold: next });
      await runGeneration();
    });
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
      ? active
      : active.filter((r) => r.genre?.toLowerCase() === effectiveGenre);

  const undergroundCount = active.filter((r) => {
    const tags = Array.isArray(r.tags) ? r.tags : [];
    return tags.includes("underground-gem");
  }).length;

  // Sektionen: neueste Generierung / Funde aus Playlists & Bibliothek / Rest
  const hasTag = (r: any, tag: string) =>
    Array.isArray(r.tags) && r.tags.includes(tag);
  const isFromCollection = (r: any) =>
    hasTag(r, "aus-playlist") || hasTag(r, "aus-bibliothek");
  const latestList = filtered.filter((r) => latestIds.has(r.id));
  const collectionFinds = filtered.filter(
    (r) => !latestIds.has(r.id) && isFromCollection(r)
  );
  const olderList = filtered.filter(
    (r) => !latestIds.has(r.id) && !isFromCollection(r)
  );

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Empfehlungen</h1>
          <p className="text-white/40 text-sm">
            {active.length} Empfehlungen ·{" "}
            <span className="text-brand-400">{undergroundCount} Underground-Perlen</span>
            {archived.length > 0 && <> · {archived.length} im Archiv</>}
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-on-brand font-medium text-sm transition-all disabled:opacity-60 glow-purple"
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

      {/* Nichts gefunden – erklären und Lösungen anbieten */}
      {noResult && (
        <div className="mb-6 p-4 rounded-xl glass border border-accent-yellow/25 text-sm">
          <p className="text-white/80 font-medium mb-1">
            Nichts Neues gefunden
          </p>
          <p className="text-white/40 text-xs leading-relaxed mb-3">
            Gesucht wurde in: {noResult.genres.slice(0, 10).join(", ")}
            {noResult.genres.length > 10 ? "…" : ""} – mit Popularity-Filter{" "}
            {noResult.threshold}/100. Alle passenden Künstler kennst du schon
            oder wurden bereits vorgeschlagen.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={relaxFilterAndRetry}
              disabled={isPending}
              className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-on-brand text-xs font-medium transition-colors disabled:opacity-50"
            >
              Popularity-Filter auf {Math.min(100, noResult.threshold + 10)}{" "}
              erhöhen & erneut suchen
            </button>
            <a
              href="/dashboard/profile"
              className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs font-medium transition-colors"
            >
              Genres im Profil erweitern
            </a>
          </div>
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

      {/* Stimmung – steuert die nächste Generierung, wird sofort gespeichert */}
      <div className="flex gap-2 flex-wrap mb-4 items-center">
        <Heart className="w-4 h-4 text-white/30" />
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
        <input
          type="text"
          value={moodText}
          onChange={(e) => setMoodText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitMoodText()}
          placeholder="Eigene Stimmung… (Enter)"
          disabled={isPending}
          className="px-3.5 py-1.5 rounded-full text-xs bg-surface-700 border border-white/10 text-white/70 placeholder-white/25 focus:outline-none focus:border-accent-pink/40 transition-colors w-44 disabled:opacity-50"
        />
      </div>

      {/* Gezielt aus einer Playlist entdecken */}
      {playlists.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4 items-center">
          <ListMusic className="w-4 h-4 text-white/30" />
          <select
            value={selectedPlaylist}
            onChange={(e) => setSelectedPlaylist(e.target.value)}
            disabled={isPending}
            className="px-3 py-1.5 rounded-full text-xs bg-surface-700 border border-white/10 text-white/70 focus:outline-none focus:border-accent-teal/40 transition-colors max-w-[16rem] disabled:opacity-50"
          >
            <option value="">Aus Playlist entdecken…</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {selectedPlaylist && (
            <button
              onClick={handleFromPlaylist}
              disabled={isPending}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-accent-teal/15 border border-accent-teal/30 text-accent-teal hover:bg-accent-teal/25 transition-colors disabled:opacity-50"
            >
              Durchsuchen
            </button>
          )}
        </div>
      )}

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
            className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-on-brand font-medium text-sm transition-all disabled:opacity-60"
          >
            {isPending ? "Generiere..." : "Jetzt starten"}
          </button>
        </div>
      )}

      {/* Grid – neueste Generierung / Playlist- & Bibliotheks-Funde / frühere */}
      {filtered.length > 0 && (
        <>
          {latestList.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-brand-400" />
                Neu generiert
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {latestList.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    rec={rec}
                    onRated={handleRated}
                    onDismiss={handleDismiss}
                    onSimilar={handleSimilar}
                  />
                ))}
              </div>
            </section>
          )}

          {collectionFinds.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2 mb-4">
                <ListMusic className="w-4 h-4 text-accent-teal" />
                Aus deinen Playlists & deiner Bibliothek
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {collectionFinds.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    rec={rec}
                    onRated={handleRated}
                    onDismiss={handleDismiss}
                    onSimilar={handleSimilar}
                  />
                ))}
              </div>
            </section>
          )}

          {olderList.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-white/30" />
                {latestIds.size > 0 ? "Frühere Empfehlungen" : "Empfehlungen"}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {olderList.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    rec={rec}
                    onRated={handleRated}
                    onDismiss={handleDismiss}
                    onSimilar={handleSimilar}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Archiv – bewertete Empfehlungen */}
      {archived.length > 0 && (
        <section className="mt-10">
          <button
            onClick={() => setShowArchive((v) => !v)}
            className="w-full flex items-center gap-2 text-sm font-semibold text-white/40 hover:text-white/70 uppercase tracking-wider mb-4 transition-colors"
          >
            {showArchive ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Archive className="w-4 h-4 text-accent-yellow/70" />
            Archiv ({archived.length})
          </button>

          {showArchive && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {archived.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  onDismiss={handleDismiss}
                  onSimilar={handleSimilar}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
