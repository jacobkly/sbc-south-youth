"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton(props: Omit<ComponentProps<typeof Button>, "onClick" | "children">) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    // Local scope: signing out here shouldn't sign out other devices.
    await createClient().auth.signOut({ scope: "local" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button {...props} disabled={pending || props.disabled} onClick={() => void signOut()}>
      <LogOutIcon />
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
