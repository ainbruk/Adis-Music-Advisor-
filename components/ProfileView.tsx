"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import {
  User2,
  Music2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Download,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { updateProfile, importSpotifyTopArtists } from "@/actions/profile";

interface Props {
  profile: any;
  hasSpotify: boolean;
  feedbackStats: { positive: boolean; _count: { id: number } }[];
}

// Popularität (0–100) grob in Streams übersetzen (logarithmische Skala:
// 0 ≈ unter 1'000, 100 ≈ über 1 Milliarde)
function streamsLabel(pop: number): string {
  const streams = Math.pow(10, 3 + (pop / 100) * 6);
  if (streams >= 1e9) return "über 1 Mrd. Streams";
  if (streams >= 1e6) return `≈ ${Math.round(streams / 1e6)} Mio. Streams`;
  return `≈ ${Math.round(streams / 1e3)}'000 Streams`;
}

export function ProfileView({ profile, hasSpotify, feedbackStats }: Props) {
  const topArtists = (profile?.topArtists ?? []) as string[];

  const [mood, setMood] = useState(profile?.currentMood ?? "");
  const [aesthetic, setAesthetic] = useState(profile?.aestheticText ?? "");
  const [threshold, setThreshold] = useState(profile?.popularityThreshold ?? 70);
  const [artists, setArtists] = useState<string[]>(topArtists);
  const [newArtist, setNewArtist] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [importPending, startImport] = useTransition();

  const posCount = feedbackStats.find((s) => s.positive)?._count.id ?? 0;
  const negCount = feedbackStats.find((s) => !s.positive)?._count.id ?? 0;
  const totalFeedback = posCount + negCount;

  const handleSave = () => {
    setSaved(false);
    setSaveError("");
    startTransition(async () => {
      const result = await updateProfile({
        currentMood: mood,
        aestheticText: aesthetic,
        popularityThreshold: threshold,
        topArtists: artists,
      });
      if (result.success) setSaved(true);
      else setSaveError(result.error ?? "Speichern fehlgeschlagen");
    });
  };

  const handleImportSpotify = () => {
    startImport(async () => {
      const res = await fetch("/api/spotify/top-artists");
      if (!res.ok) return;
      const data = await res.json();
      const imported = (data.artists ?? []).map((a: any) => a.name);
      setArtists(imported);
      await importSpotifyTopArtists(data.artists ?? []);
    });
  };

  // Künstler-Änderungen sofort speichern – nicht erst beim "Profil speichern"
  const persistArtists = (next: string[]) => {
    startTransition(async () => {
      const result = await updateProfile({ topArtists: next });
      if (!result.success)
        setSaveError(result.error ?? "Speichern fehlgeschlagen");
    });
  };

  const addArtist = () => {
    const trimmed = newArtist.trim();
    if (trimmed && !artists.includes(trimmed)) {
      const next = [...artists, trimmed];
      setArtists(next);
      persistArtists(next);
    }
    setNewArtist("");
  };

  const removeArtist = (name: string) => {
    const next = artists.filter((a) => a !== name);
    setArtists(next);
    persistArtists(next);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Mein Profil</h1>
        <p className="text-white/40 text-sm">
          Verfeinere deinen persönlichen Musik-Algorithmus
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-2 space-y-6">
          {/* Spotify Connection */}
          <section className="glass rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#1DB954]">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Spotify-Integration
            </h2>

            {hasSpotify ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#1DB954]/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-[#1DB954]" />
                </div>
                <div>
                  <p className="text-white/80 text-sm font-medium">Verbunden</p>
                  <p className="text-white/35 text-xs">Deine Top-Künstler werden importiert</p>
                </div>
                <button
                  onClick={handleImportSpotify}
                  disabled={importPending}
                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1DB954]/15 hover:bg-[#1DB954]/25 text-[#1DB954] text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  {importPending ? "Importiere..." : "Top-Künstler importieren"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("spotify", { callbackUrl: "/dashboard/profile" })}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-sm transition-colors"
              >
                Mit Spotify verbinden
              </button>
            )}
          </section>

          {/* Mood & Aesthetic */}
          <section className="glass rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand-400" />
              Stimmung & Ästhetik
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  Aktuelle Stimmung
                </label>
                <input
                  type="text"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="z.B. 'Nachdenklich und introspektiv'"
                  className="w-full bg-surface-700 border border-white/10 rounded-xl px-4 py-3 text-white/80 text-sm placeholder-white/20 focus:outline-none focus:border-brand-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  Spezifische Ästhetik
                </label>
                <textarea
                  value={aesthetic}
                  onChange={(e) => setAesthetic(e.target.value)}
                  placeholder="z.B. 'Melodic Techno mit melancholischer Note, tiefe atmosphärische Texturen'"
                  rows={3}
                  className="w-full bg-surface-700 border border-white/10 rounded-xl px-4 py-3 text-white/80 text-sm placeholder-white/20 focus:outline-none focus:border-brand-500/50 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  Popularity-Filter
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="flex-1 accent-brand-500"
                  />
                  <span className="text-brand-300 font-mono text-sm w-28 text-right">
                    {streamsLabel(threshold)}
                  </span>
                </div>
                <div className="flex justify-between text-white/25 text-xs mt-1">
                  <span>unter 1'000 Streams</span>
                  <span>über 1 Mrd. Streams</span>
                </div>
                <p className="text-white/25 text-xs mt-1">
                  Künstler mit mehr als {streamsLabel(threshold)} werden
                  herausgefiltert (Popularität {threshold}/100)
                </p>
              </div>
            </div>
          </section>

          {/* Top Artists */}
          <section className="glass rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Music2 className="w-4 h-4 text-accent-coral" />
              Top-Künstler ({artists.length}/100)
            </h2>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newArtist}
                onChange={(e) => setNewArtist(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addArtist()}
                placeholder="Künstlername hinzufügen..."
                className="flex-1 bg-surface-700 border border-white/10 rounded-xl px-4 py-2.5 text-white/80 text-sm placeholder-white/20 focus:outline-none focus:border-brand-500/50 transition-colors"
              />
              <button
                onClick={addArtist}
                className="px-4 py-2.5 rounded-xl bg-brand-600/30 hover:bg-brand-600/50 text-brand-300 text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {artists.map((a) => (
                <span
                  key={a}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700 border border-white/10 text-white/70 text-xs"
                >
                  {a}
                  <button
                    onClick={() => removeArtist(a)}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {artists.length === 0 && (
                <p className="text-white/25 text-sm">
                  Noch keine Künstler – importiere sie von Spotify oder füge sie manuell hinzu.
                </p>
              )}
            </div>
          </section>

          {/* Save button */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-on-brand font-medium text-sm transition-all disabled:opacity-60 glow-purple"
            >
              {isPending ? "Speichern..." : "Profil speichern"}
            </button>

            {saved && (
              <div className="flex items-center gap-2 text-[#1DB954] text-sm animate-fade-in">
                <CheckCircle2 className="w-4 h-4" />
                Gespeichert
              </div>
            )}
            {saveError && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {saveError}
              </div>
            )}
          </div>
        </div>

        {/* Right column – stats */}
        <div className="space-y-4">
          <section className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white/60 mb-4 uppercase tracking-wider">
              Feedback-Statistik
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1DB954]/15 flex items-center justify-center">
                  <ThumbsUp className="w-3.5 h-3.5 text-[#1DB954]" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{posCount}</p>
                  <p className="text-white/35 text-xs">Positiv</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
                  <ThumbsDown className="w-3.5 h-3.5 text-red-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{negCount}</p>
                  <p className="text-white/35 text-xs">Negativ</p>
                </div>
              </div>
            </div>

            {totalFeedback > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-white/40 mb-1">
                  <span>Trefferquote</span>
                  <span>{Math.round((posCount / totalFeedback) * 100)}%</span>
                </div>
                <div className="popularity-bar">
                  <div
                    className="popularity-fill bg-gradient-to-r from-[#1DB954] to-accent-teal"
                    style={{ width: `${(posCount / totalFeedback) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </section>

          <section className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wider">
              Algorithmus-Status
            </h3>
            <div className="space-y-2">
              {[
                { label: "Popularity-Schwelle", value: `${threshold}/100`, ok: true },
                { label: "Top-Künstler", value: `${artists.length}`, ok: artists.length > 0 },
                { label: "Stimmung", value: mood ? "Gesetzt" : "–", ok: !!mood },
                { label: "Spotify", value: hasSpotify ? "Verbunden" : "Getrennt", ok: hasSpotify },
                { label: "Feedback-Daten", value: `${totalFeedback}`, ok: totalFeedback > 0 },
              ].map(({ label, value, ok }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-white/40">{label}</span>
                  <span className={`font-medium ${ok ? "text-[#1DB954]" : "text-white/30"}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
