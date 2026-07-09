"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

interface Props {
  showLabel?: boolean;
  className?: string;
}

export function ThemeToggle({ showLabel = false, className }: Props) {
  const [light, setLight] = useState(false);

  // Initialen Zustand vom <html>-Element übernehmen (durch Inline-Script gesetzt)
  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    const root = document.documentElement;
    root.classList.toggle("light", next);
    root.classList.toggle("dark", !next);
    try {
      localStorage.setItem("cv-theme", next ? "light" : "dark");
    } catch {
      // localStorage nicht verfügbar – Theme gilt nur für diese Sitzung
    }
  };

  return (
    <button
      onClick={toggle}
      title={light ? "Dark Mode" : "Light Mode"}
      className={
        className ??
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/80 hover:bg-white/5 transition-all"
      }
    >
      {light ? (
        <Moon className="w-4 h-4 flex-shrink-0" />
      ) : (
        <Sun className="w-4 h-4 flex-shrink-0" />
      )}
      {showLabel && <span>{light ? "Dark Mode" : "Light Mode"}</span>}
    </button>
  );
}
