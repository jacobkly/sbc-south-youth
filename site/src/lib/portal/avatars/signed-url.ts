/** Picture links last an hour. The bucket is private, so a link is the only way to show one. */
export const AVATAR_URL_SECONDS = 3600;

/** Links are re-signed ten minutes early, so a picture shown just before expiry still loads. */
const RESIGN_AFTER_MS = (AVATAR_URL_SECONDS - 10 * 60) * 1000;

type Entry = {
  url: Promise<string | null>;
  /** The link once it's known. */
  value?: string;
  freshUntil: number;
};

/**
 * Signed picture links by path, shared by every picture on the page and kept
 * across client navigations, so moving between pages doesn't sign and
 * download the same picture again. A new picture has a new path, so an old
 * link is never shown for it.
 */
export function createAvatarUrlCache(sign: (path: string) => Promise<string | null>, now: () => number = Date.now) {
  const entries = new Map<string, Entry>();

  function fresh(path: string): Entry | undefined {
    const entry = entries.get(path);
    return entry && now() < entry.freshUntil ? entry : undefined;
  }

  return {
    /** The link for `path`, or null when it couldn't be made. */
    get(path: string): Promise<string | null> {
      const cached = fresh(path);
      if (cached) return cached.url;

      const url = sign(path).catch(() => null);
      const entry: Entry = { url, freshUntil: now() + RESIGN_AFTER_MS };
      entries.set(path, entry);
      void url.then((value) => {
        if (value) entry.value = value;
        // Failed links aren't kept, so the next look tries again.
        else if (entries.get(path) === entry) entries.delete(path);
      });
      return url;
    },

    /** The link for `path` if it's already known, so a picture can show on the first render. */
    peek(path: string): string | undefined {
      return fresh(path)?.value;
    },

    /** Shows a just-saved picture from its local copy, which lasts as long as the page. */
    prime(path: string, localUrl: string) {
      entries.set(path, { url: Promise.resolve(localUrl), value: localUrl, freshUntil: Infinity });
    },
  };
}
