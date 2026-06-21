"use client";

import { useState } from "react";
import { X, ThumbsDown, AlertCircle } from "lucide-react";
import { submitFeedback } from "@/actions/feedback";

const NEGATIVE_CATEGORIES = [
  "Zu poppig",
  "Zu aggressiv",
  "Zu experimentell",
  "Nicht mein Genre",
  "Kenne ich schon",
  "Zu kommerziell",
  "Fehlt Tiefe",
  "Andere",
];

interface Props {
  recommendationId: string;
  artistName: string;
  onClose: () => void;
  onSubmit: (result: { reason?: string }) => void;
}

export function FeedbackPanel({ recommendationId, artistName, onClose, onSubmit }: Props) {
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    const result = await submitFeedback({
      recommendationId,
      positive: false,
      category: category || undefined,
      reason: reason || undefined,
    });
    setLoading(false);
    if (result.success) {
      onSubmit({ reason });
    } else {
      setError(result.error ?? "Fehler beim Speichern");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl p-6 w-full max-w-md animate-fade-in">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              <ThumbsDown className="w-4 h-4 text-red-400" />
              Feedback zu: {artistName}
            </h3>
            <p className="text-white/40 text-sm mt-0.5">
              Hilf uns, deine Empfehlungen zu verbessern.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category chips */}
        <div className="mb-4">
          <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">
            Grund
          </p>
          <div className="flex flex-wrap gap-2">
            {NEGATIVE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat === category ? "" : cat)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                  ${
                    category === cat
                      ? "bg-red-500/20 border-red-500/40 text-red-300"
                      : "bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"
                  }
                `}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Freetext */}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optionaler Kommentar..."
          rows={3}
          maxLength={500}
          className="w-full bg-surface-700 border border-white/10 rounded-xl px-4 py-3 text-white/80 text-sm placeholder-white/25 resize-none focus:outline-none focus:border-brand-500/50 mb-4"
        />

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Speichern..." : "Feedback senden"}
          </button>
        </div>
      </div>
    </div>
  );
}
