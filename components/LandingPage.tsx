"use client";

import { signIn } from "next-auth/react";
import {
  Music2,
  Headphones,
  Zap,
  Star,
  TrendingDown,
  ArrowRight,
  Waves,
} from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-900 overflow-hidden relative">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-pink/10 rounded-full blur-3xl" />
        <div className="absolute top-3/4 left-1/3 w-64 h-64 bg-accent-coral/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-6 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center glow-purple">
            <Waves className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold gradient-text">CuratedVibe</span>
        </div>
        <button
          onClick={() => signIn("spotify", { callbackUrl: "/dashboard" })}
          className="px-5 py-2.5 text-sm font-medium rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition-all duration-200 flex items-center gap-2"
        >
          <span>Anmelden</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </header>

      {/* Hero */}
      <main className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-brand-300 text-sm font-medium mb-8 border border-brand-600/30">
            <Star className="w-4 h-4 text-accent-yellow fill-accent-yellow" />
            <span>Anti-Mainstream · Kuratiert · Tief</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Musik, die{" "}
            <span className="gradient-text">bewegt</span>
            <br />
            statt{" "}
            <span className="text-white/40 line-through decoration-accent-coral/60">
              Fliessband
            </span>
          </h1>

          <p className="text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
            CuratedVibe analysiert deinen Geschmack und findet musikalische Perlen
            jenseits des Mainstreams – mit KI-gestütztem Anti-Mainstream-Algorithmus
            und persönlicher Feedback-Schlaufe.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => signIn("spotify", { callbackUrl: "/dashboard" })}
              className="group px-8 py-4 rounded-2xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-lg transition-all duration-200 flex items-center gap-3 justify-center glow-purple"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Mit Spotify verbinden
            </button>

            <a
              href="#features"
              className="px-8 py-4 rounded-2xl glass glass-hover text-white font-medium text-lg flex items-center gap-2 justify-center"
            >
              Mehr erfahren
            </a>
          </div>
        </div>

        {/* Feature Cards */}
        <div id="features" className="grid md:grid-cols-3 gap-6 pb-24">
          {[
            {
              icon: TrendingDown,
              color: "text-accent-coral",
              bg: "bg-accent-coral/10",
              title: "Anti-Massenproduzenten-Filter",
              desc: "Filtert Mainstream-Hits heraus und findet Künstler mit hoher Qualität bei geringer Popularität – echte Perlen statt Fliessband.",
            },
            {
              icon: Zap,
              color: "text-brand-400",
              bg: "bg-brand-500/10",
              title: "Feedback-Schlaufe",
              desc: "Jede Rückmeldung verfeinert deinen persönlichen Algorithmus. Das System lernt kontinuierlich, was dich wirklich bewegt.",
            },
            {
              icon: Headphones,
              color: "text-accent-teal",
              bg: "bg-accent-teal/10",
              title: "Spotify + SoundCloud",
              desc: "Eingebettete Player für Spotify und SoundCloud – entdecke Nischen-Tracks und Underground-Sets direkt im Dashboard.",
            },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-7 glass-hover">
              <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mb-5`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <h3 className="text-lg font-semibold mb-3 text-white">{title}</h3>
              <p className="text-white/55 leading-relaxed text-sm">{desc}</p>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap justify-center gap-12 pb-24 text-center">
          {[
            { value: "100", label: "Top-Künstler" },
            { value: "<70", label: "Popularity-Filter" },
            { value: "∞", label: "Lernschritte" },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-4xl font-bold gradient-text mb-1">{value}</div>
              <div className="text-white/40 text-sm">{label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <Music2 className="w-4 h-4" />
            <span>CuratedVibe © 2024</span>
          </div>
          <p className="text-white/25 text-xs">
            Gebaut mit Leidenschaft für tiefgründige Musik
          </p>
        </div>
      </footer>
    </div>
  );
}
