"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createAvatarUrlCache, AVATAR_URL_SECONDS } from "@/lib/avatars/signed-url";
import { AVATARS_BUCKET } from "@/lib/avatars/upload";
import { createClient } from "@/lib/supabase/client";

/** One cache for the whole page, so the sidebar and account page share a link. */
export const avatarUrls = createAvatarUrlCache(async (path) => {
  const { data, error } = await createClient().storage.from(AVATARS_BUCKET).createSignedUrl(path, AVATAR_URL_SECONDS);
  return error ? null : data.signedUrl;
});

/** Up to two initials, like "PE" for Pat Example. */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean);
  const picked = letters.length > 1 ? [letters[0], letters.at(-1)] : letters;
  return picked.join("").toUpperCase() || "?";
}

/** A signed link for a picture path. Null while it loads, when there's no picture, or when it can't be made. */
function useAvatarUrl(path: string | null): string | null {
  const [loaded, setLoaded] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!path) return;
    let active = true;
    void avatarUrls.get(path).then((url) => {
      if (active) setLoaded({ path, url });
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (!path) return null;
  if (loaded?.path === path) return loaded.url;
  // Already signed on an earlier page, so it can show on the first render.
  return avatarUrls.peek(path) ?? null;
}

/**
 * A user's profile picture, or their initials when they have none or it
 * can't load. It's decorative: the name is always shown next to it.
 * `src` shows a local picture instead, such as a preview before saving.
 */
export function UserAvatar({
  name,
  path,
  src,
  className,
}: {
  name: string;
  path: string | null;
  src?: string;
  className?: string;
}) {
  const signed = useAvatarUrl(src ? null : path);
  const url = src ?? signed;

  return (
    <Avatar aria-hidden className={cn("text-xs font-semibold", className)}>
      {url && <AvatarImage src={url} alt="" />}
      <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
