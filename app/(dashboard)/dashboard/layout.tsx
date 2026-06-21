import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Navigation } from "@/components/Navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch {
    // Keine Session möglich (z.B. DB nicht konfiguriert)
    redirect("/");
  }

  if (!session?.user) redirect("/");

  return (
    <div className="min-h-screen bg-surface-900 flex">
      <Navigation user={session.user} />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
