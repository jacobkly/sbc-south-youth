"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlusIcon, LoaderCircleIcon } from "lucide-react";
import { avatarUrls, UserAvatar } from "@/components/nav/user-avatar";
import { Button } from "@/components/ui/button";
import { processAvatar, type ProcessedAvatar } from "@/lib/avatars/compress";
import { removeAvatar, saveAvatar } from "@/lib/avatars/upload";
import { UnusableFileError } from "@/lib/images/canvas";
import { createClient } from "@/lib/supabase/client";

/** A picked photo, shrunk and shown before it's saved. */
type Draft = { picture: ProcessedAvatar; url: string };

type Busy = "processing" | "saving" | "removing" | null;

export function AvatarForm({ userId, name, avatarPath }: { userId: string; name: string; avatarPath: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  // Shows a save or remove right away, before the refreshed page arrives.
  const [changed, setChanged] = useState<{ path: string | null } | null>(null);
  const path = changed ? changed.path : avatarPath;
  // A saved preview keeps showing in the sidebar, so its local copy stays.
  const kept = useRef<string | null>(null);

  useEffect(() => {
    if (!draft) return;
    return () => {
      if (kept.current !== draft.url) URL.revokeObjectURL(draft.url);
    };
  }, [draft]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy("processing");
    setMessage(null);
    try {
      const picture = await processAvatar(file);
      setDraft({ picture, url: URL.createObjectURL(picture.blob) });
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof UnusableFileError ? error.message : "This photo couldn't be used. Try another one.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy("saving");
    setMessage(null);
    try {
      const saved = await saveAvatar(createClient(), userId, draft.picture);
      kept.current = draft.url;
      avatarUrls.prime(saved, draft.url);
      setChanged({ path: saved });
      setDraft(null);
      setMessage({ kind: "saved", text: "Saved." });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Couldn't save your photo. Try again." });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("removing");
    setMessage(null);
    try {
      await removeAvatar(createClient(), userId);
      setChanged({ path: null });
      setMessage({ kind: "saved", text: "Removed." });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Couldn't remove your photo. Try again." });
    } finally {
      setBusy(null);
    }
  }

  const status = message
    ? message.text
    : draft
      ? "New photo ready. Save it to use it."
      : null;

  return (
    <section aria-labelledby="picture-heading" className="flex items-center gap-4">
      <UserAvatar name={name} path={path} src={draft?.url} className="size-20 text-2xl" />

      <div className="min-w-0 flex-1 space-y-2">
        <h2 id="picture-heading" className="text-sm font-medium">
          Profile photo
        </h2>

        <input
          ref={input}
          type="file"
          accept="image/*"
          // Not `hidden`: some iOS versions ignore clicks on a display:none file input.
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            // Lets the same photo be picked again.
            event.target.value = "";
          }}
        />

        {/* The first button stays in place from pick to save, so focus does too. */}
        <div className="flex flex-wrap gap-2">
          {draft ? (
            <>
              <Button type="button" className="h-11 px-5" disabled={busy !== null} onClick={() => void save()}>
                {busy === "saving" && <LoaderCircleIcon className="animate-spin" aria-hidden />}
                {busy === "saving" ? "Saving…" : "Save photo"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 px-5"
                disabled={busy !== null}
                onClick={() => {
                  setDraft(null);
                  setMessage(null);
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-11 px-4"
                disabled={busy !== null}
                onClick={() => input.current?.click()}
              >
                {busy === "processing" ? (
                  <LoaderCircleIcon className="animate-spin" aria-hidden />
                ) : (
                  <ImagePlusIcon aria-hidden />
                )}
                {busy === "processing" ? "Preparing…" : path ? "Change photo" : "Choose photo"}
              </Button>
              {path && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 px-4 text-muted-foreground"
                  disabled={busy !== null}
                  onClick={() => void remove()}
                >
                  {busy === "removing" ? "Removing…" : "Remove"}
                </Button>
              )}
            </>
          )}
        </div>

        {status && (
          <p
            role={message?.kind === "error" ? "alert" : "status"}
            className={message?.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
          >
            {status}
          </p>
        )}
      </div>
    </section>
  );
}
