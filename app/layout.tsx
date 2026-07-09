import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "CuratedVibe – Dein persönlicher Music Advisor",
  description:
    "Entdecke musikalische Perlen jenseits des Mainstreams. KI-gestützter Music Advisor mit Spotify-Integration und Anti-Massenproduzenten-Algorithmus.",
  keywords: ["Musik", "Underground", "Spotify", "Empfehlungen", "Indie", "Deep Cuts"],
  openGraph: {
    title: "CuratedVibe",
    description: "Personalisierter Music Advisor für tiefgründige, berührende Musik",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark">
      <body className="bg-surface-900 text-white antialiased">
        {/* Theme vor dem ersten Paint setzen – verhindert Aufblitzen */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('cv-theme')==='light'){var r=document.documentElement;r.classList.add('light');r.classList.remove('dark');}}catch(e){}",
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
