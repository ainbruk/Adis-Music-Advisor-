import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Anmeldung fehlgeschlagen</h1>
        <p className="text-white/50 text-sm mb-6 leading-relaxed">
          Die Anmeldung mit Spotify konnte nicht abgeschlossen werden.
          Bitte stelle sicher, dass die Callback-URL korrekt im Spotify-Dashboard
          konfiguriert ist.
        </p>
        <div className="bg-surface-700 rounded-xl p-4 text-left mb-6 text-xs font-mono text-white/40 break-all">
          {process.env.NEXTAUTH_URL ?? "http://localhost:3000"}
          /api/auth/callback/spotify
        </div>
        <Link
          href="/"
          className="inline-flex items-center px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-on-brand text-sm font-medium transition-colors"
        >
          Zurück zur Startseite
        </Link>
      </div>
    </div>
  );
}
