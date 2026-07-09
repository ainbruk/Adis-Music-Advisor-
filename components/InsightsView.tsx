"use client";

import { Radar, Music2, Star, Target, ListMusic } from "lucide-react";

interface FeedbackEntry {
  id: string;
  positive: boolean;
  rating?: number | null;
  createdAt: string | Date;
  recommendation: {
    genre?: string | null;
    artistName: string;
    trackName?: string | null;
  };
}

interface GenreCount {
  genre: string | null;
  _count: { id: number };
}

interface Props {
  feedbacks: FeedbackEntry[];
  genreCounts: GenreCount[];
}

// Alte Daumen-Bewertungen auf die 0–10-Skala abbilden
function effectiveRating(f: FeedbackEntry): number {
  return f.rating ?? (f.positive ? 8 : 2);
}

const BRAND = "#8b5cf6";

export function InsightsView({ feedbacks, genreCounts }: Props) {
  // Pro Genre: wie oft empfohlen, wie oft bewertet, Ø Bewertung
  const stats = new Map<
    string,
    { recommended: number; rated: number; sum: number }
  >();
  for (const gc of genreCounts) {
    const g = (gc.genre ?? "").toLowerCase();
    if (!g) continue;
    const entry = stats.get(g) ?? { recommended: 0, rated: 0, sum: 0 };
    entry.recommended += gc._count.id;
    stats.set(g, entry);
  }
  for (const f of feedbacks) {
    const g = (f.recommendation.genre ?? "").toLowerCase();
    if (!g) continue;
    const entry = stats.get(g) ?? { recommended: 0, rated: 0, sum: 0 };
    entry.rated += 1;
    entry.sum += effectiveRating(f);
    stats.set(g, entry);
  }

  const rows = Array.from(stats.entries())
    .map(([genre, s]) => ({
      genre,
      recommended: s.recommended,
      rated: s.rated,
      avg: s.rated > 0 ? s.sum / s.rated : null,
    }))
    .sort((a, b) => b.rated - a.rated || (b.avg ?? 0) - (a.avg ?? 0));

  // Netz: bis zu 8 Genres mit mindestens einer Bewertung
  const radarRows = rows.filter((r) => r.avg !== null).slice(0, 8);

  const totalRecommended = genreCounts.reduce((n, g) => n + g._count.id, 0);
  const totalRated = feedbacks.length;
  const avgRating =
    totalRated > 0
      ? feedbacks.reduce((n, f) => n + effectiveRating(f), 0) / totalRated
      : null;
  const positiveShare =
    totalRated > 0
      ? Math.round(
          (feedbacks.filter((f) => f.positive).length / totalRated) * 100
        )
      : null;

  // Radar-Geometrie
  const CX = 210;
  const CY = 178;
  const R = 112;
  const N = radarRows.length;
  const point = (i: number, value: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const r = (value / 10) * R;
    return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)] as const;
  };
  const ringPath = (value: number) =>
    radarRows
      .map((_, i) => {
        const [x, y] = point(i, value);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  const kpis = [
    { icon: ListMusic, label: "Empfohlen", value: String(totalRecommended) },
    { icon: Star, label: "Bewertet", value: String(totalRated) },
    {
      icon: Radar,
      label: "Ø Bewertung",
      value: avgRating !== null ? avgRating.toFixed(1) : "–",
    },
    {
      icon: Target,
      label: "Trefferquote",
      value: positiveShare !== null ? `${positiveShare}%` : "–",
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Bewertungsnetz</h1>
        <p className="text-white/40 text-sm">
          Wie deine Empfehlungen ankamen – nach Genre
        </p>
      </div>

      {/* KPI-Reihe */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {kpis.map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 text-white/35 text-xs mb-1.5">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Netzdiagramm */}
      <section className="glass rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-2">
          Genre-Profil (Ø Bewertung 0–10)
        </h2>

        {N >= 3 ? (
          <svg
            viewBox="0 0 420 370"
            className="w-full max-w-lg mx-auto"
            role="img"
            aria-label="Netzdiagramm der durchschnittlichen Bewertungen pro Genre"
          >
            {/* Gitterringe */}
            {[2.5, 5, 7.5, 10].map((v) => (
              <path
                key={v}
                d={ringPath(v)}
                fill="none"
                className="stroke-white/10"
                strokeWidth={1}
              />
            ))}
            {/* Achsen */}
            {radarRows.map((_, i) => {
              const [x, y] = point(i, 10);
              return (
                <line
                  key={i}
                  x1={CX}
                  y1={CY}
                  x2={x}
                  y2={y}
                  className="stroke-white/10"
                  strokeWidth={1}
                />
              );
            })}
            {/* Datenfläche */}
            <path
              d={
                radarRows
                  .map((r, i) => {
                    const [x, y] = point(i, r.avg ?? 0);
                    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(" ") + " Z"
              }
              fill={BRAND}
              fillOpacity={0.2}
              stroke={BRAND}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {/* Punkte mit nativen Tooltips */}
            {radarRows.map((r, i) => {
              const [x, y] = point(i, r.avg ?? 0);
              return (
                <circle
                  key={r.genre}
                  cx={x}
                  cy={y}
                  r={3.5}
                  fill={BRAND}
                  className="stroke-surface-900"
                  strokeWidth={2}
                >
                  <title>
                    {r.genre}: Ø {(r.avg ?? 0).toFixed(1)}/10 ({r.rated}{" "}
                    bewertet)
                  </title>
                </circle>
              );
            })}
            {/* Genre-Beschriftungen */}
            {radarRows.map((r, i) => {
              const angle = -Math.PI / 2 + (i * 2 * Math.PI) / N;
              const lx = CX + (R + 20) * Math.cos(angle);
              const ly = CY + (R + 20) * Math.sin(angle);
              const anchor =
                Math.abs(Math.cos(angle)) < 0.3
                  ? "middle"
                  : Math.cos(angle) > 0
                    ? "start"
                    : "end";
              return (
                <text
                  key={r.genre}
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fontSize={10}
                  className="fill-white/50"
                >
                  {r.genre}
                </text>
              );
            })}
          </svg>
        ) : (
          <p className="text-white/30 text-sm py-8 text-center">
            Bewerte Empfehlungen aus mindestens 3 Genres, um dein
            Bewertungsnetz zu sehen.
          </p>
        )}
      </section>

      {/* Genre-Tabelle: empfohlen & bewertet */}
      <section className="glass rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Music2 className="w-4 h-4 text-brand-400" />
          Nach Genre
        </h2>

        {rows.length === 0 && (
          <p className="text-white/30 text-sm">
            Noch keine Empfehlungen generiert.
          </p>
        )}

        <div className="space-y-4">
          {rows.slice(0, 15).map((r) => (
            <div key={r.genre}>
              <div className="flex justify-between items-baseline text-sm mb-1">
                <span className="text-white/70">{r.genre}</span>
                <span className="text-white/35 text-xs">
                  {r.recommended} empfohlen · {r.rated} bewertet
                  {r.avg !== null && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="text-brand-300 font-medium">
                        Ø {r.avg.toFixed(1)}
                      </span>
                    </>
                  )}
                </span>
              </div>
              <div className="popularity-bar">
                <div
                  className="popularity-fill bg-gradient-to-r from-brand-600 to-brand-400"
                  style={{ width: `${((r.avg ?? 0) / 10) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
