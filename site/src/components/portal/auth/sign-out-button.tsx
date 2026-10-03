"use client";

import { useState, type ComponentProps } from "react";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { createClient } from "@/lib/supabase/client";

/** Signs out on this device and goes to the sign-in page. */
export function useSignOut() {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    // Local scope: signing out here shouldn't sign out other devices.
    await createClient().auth.signOut({ scope: "local" });
    // A full page load, not a client navigation. The router keeps recent
    // pages alive in the background, and the next person on this device
    // shouldn't find the last one's pages there.
    window.location.replace("/login");
  }

  return { pending, signOut };
}

export function SignOutButton(props: Omit<ComponentProps<typeof Button>, "onClick" | "children">) {
  const { pending, signOut } = useSignOut();

  return (
    <Button {...props} disabled={pending || props.disabled} onClick={() => void signOut()}>
      <LogOutIcon />
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
