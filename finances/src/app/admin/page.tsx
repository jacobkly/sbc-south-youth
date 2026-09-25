import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Placeholder until the dashboard cards and charts are built.
export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Welcome, {user?.full_name}.</p>
    </div>
  );
}
