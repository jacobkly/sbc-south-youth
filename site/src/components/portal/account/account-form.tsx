"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/portal/ui/button";
import { Input } from "@/components/portal/ui/input";
import { Label } from "@/components/portal/ui/label";
import { createClient } from "@/lib/supabase/client";

const MAX_NAME_LENGTH = 100;

export function AccountForm({ userId, fullName }: { userId: string; fullName: string }) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "saved" | "error"; text: string } | null>(null);

  const trimmed = name.trim();
  const invalid = trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH;

  async function save() {
    setPending(true);
    setMessage(null);
    // RLS silently skips the update if it isn't allowed, so check that a row came back.
    const { data, error } = await createClient()
      .from("users")
      .update({ full_name: trimmed })
      .eq("id", userId)
      .select("id");
    setPending(false);

    if (error || data.length === 0) {
      setMessage({ kind: "error", text: "Couldn't save your name. Try again." });
      return;
    }

    setName(trimmed);
    setMessage({ kind: "saved", text: "Saved." });
    router.refresh();
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid) void save();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="full-name">Name</Label>
        <Input
          id="full-name"
          autoComplete="name"
          required
          maxLength={MAX_NAME_LENGTH}
          value={name}
          aria-invalid={trimmed.length === 0 || undefined}
          aria-describedby={message ? "full-name-message" : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setMessage(null);
          }}
          className="h-11"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" className="h-11 px-6" disabled={pending || invalid || trimmed === fullName}>
          {pending ? "Saving…" : "Save name"}
        </Button>
        {message && (
          <p
            id="full-name-message"
            role={message.kind === "error" ? "alert" : "status"}
            className={message.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
