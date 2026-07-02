"use client";

import { signIn } from "next-auth/react";

interface Props {
  className?: string;
  children: React.ReactNode;
}

export function SpotifySignInButton({ className, children }: Props) {
  return (
    <button
      className={className}
      onClick={() => signIn("spotify", { callbackUrl: "/dashboard" })}
    >
      {children}
    </button>
  );
}
