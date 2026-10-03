import { SignOutButton } from "@/components/portal/auth/sign-out-button";
import { createClient } from "@/lib/supabase/server";

// It reads the sign-in cookie, so it renders on each request.
export const instant = false;

// TODO(portal): replace with the signed-in home once the portal's shell exists.
export default async function PortalHome() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims.email === "string" ? data.claims.email : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">SBC South Youth Portal</h1>
        {email && (
          <p className="mt-1 text-sm break-all text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{email}</span>
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">More is coming soon.</p>
        <SignOutButton variant="outline" className="mt-6 h-11 w-full" />
      </div>
    </main>
  );
}
