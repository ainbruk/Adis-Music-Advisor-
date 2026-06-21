import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { LandingPage } from "@/components/LandingPage";

export default async function Home() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user) redirect("/dashboard");
  } catch {
    // Auth nicht konfiguriert – Landing Page anzeigen
  }

  return <LandingPage />;
}
