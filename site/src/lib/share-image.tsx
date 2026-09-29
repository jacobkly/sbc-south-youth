import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import { home } from "@/content/home";
import { site } from "@/content/site";
import { placeholderArt } from "./placeholder-art";
import { SHARE_SIZE, fontFileUrl, sharePhotoUrl, titleSize } from "./share";

/**
 * The link preview posters: what shows up when someone shares a page in
 * a group chat. Drawn like the site, near-black with big type and the
 * accent. They're made when the site builds.
 */

// The dark theme's colors, from globals.css.
const colors = { bg: "#0b0b0f", text: "#f5f3ee", muted: "#a7a5a0", accent: "#3db1ff" };

/** A Google font as a TrueType file, or null so the poster falls back to the built-in font. */
async function googleFont(family: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}`, { signal: AbortSignal.timeout(10_000) });
    const file = css.ok ? fontFileUrl(await css.text()) : null;
    if (!file) return null;
    const font = await fetch(file, { signal: AbortSignal.timeout(10_000) });
    return font.ok ? await font.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * Bricolage at its heaviest display cut, like the site's headlines, and
 * Geist for the small text. Cached, so they download once per build.
 */
async function posterFonts() {
  "use cache";
  cacheLife("max");
  const [display, text] = await Promise.all([
    googleFont("Bricolage+Grotesque:opsz,wght@96,800"),
    googleFont("Geist:wght@600"),
  ]);
  return [
    display && { name: "Bricolage", data: display, weight: 800 as const, style: "normal" as const },
    text && { name: "Geist", data: text, weight: 600 as const, style: "normal" as const },
  ].filter((font) => font !== null);
}

// A local file that never changes, so it's read once when the module loads.
const logo = readFileSync(join(process.cwd(), "src/assets/logo.png"), "base64");

/**
 * A photo as a data URL, or null if it can't be fetched, so a slow photo
 * host never breaks the build. Cached, so rebuilding an event's poster
 * doesn't download its photo again.
 */
export async function sharePhoto(src: string): Promise<string | null> {
  "use cache";
  cacheLife("days");
  try {
    const response = await fetch(sharePhotoUrl(src), { signal: AbortSignal.timeout(10_000) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(jpeg|png)/.test(type)) return null;
    const data = Buffer.from(await response.arrayBuffer()).toString("base64");
    return `data:${type};base64,${data}`;
  } catch {
    return null;
  }
}

export type SharePoster = {
  /** The small line over the title, in the accent. */
  eyebrow?: string;
  title: string;
  /** A line under the title, like the time and place. */
  detail?: string;
  /** A photo behind it all, from sharePhoto. */
  photo?: string | null;
  /** Picks generated art when there's no photo. Without one, it's the plain poster. */
  seed?: string;
};

export async function sharePoster({ eyebrow, title, detail, photo, seed }: SharePoster): Promise<ImageResponse> {
  const size = titleSize(title);
  const fonts = await posterFonts();

  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: 72,
        backgroundColor: colors.bg,
        color: colors.text,
        fontFamily: "Geist",
        fontWeight: 600,
      }}
    >
      <Backdrop photo={photo} seed={seed} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- drawn to a PNG, not a page */}
          <img src={`data:image/png;base64,${logo}`} width={51} height={56} alt="" />
          <span style={{ fontSize: 30 }}>{site.name}</span>
        </div>
        <span style={{ fontSize: 26, color: photo || seed ? "rgba(255,255,255,0.8)" : colors.muted }}>
          {new URL(site.url).host}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", maxWidth: 1000 }}>
        {eyebrow && (
          <span style={{ fontSize: 28, color: colors.accent, textTransform: "uppercase", letterSpacing: 3 }}>{eyebrow}</span>
        )}
        <span
          style={{
            marginTop: eyebrow ? 18 : 0,
            fontFamily: "Bricolage",
            fontWeight: 800,
            fontSize: size,
            lineHeight: 0.95,
            letterSpacing: -0.02 * size,
          }}
        >
          {title}
        </span>
        {detail && <span style={{ marginTop: 26, fontSize: 30, color: "rgba(255,255,255,0.8)" }}>{detail}</span>}
      </div>
    </div>,
    { ...SHARE_SIZE, fonts: fonts.length > 0 ? fonts : undefined },
  );
}

/** The Home poster: the hero photo and headline. The links page shares it too. */
export const homePosterAlt = `${site.name}: ${home.hero.title}`;

export async function homePoster(): Promise<ImageResponse> {
  const photo = await sharePhoto(home.hero.photo.src);
  return sharePoster({ title: home.hero.title, detail: site.tagline, photo, seed: "home" });
}

/** A photo or generated art under a dark fade, or the accent glow and ring on the plain poster. */
function Backdrop({ photo, seed }: { photo?: string | null; seed?: string }) {
  const fill = { position: "absolute", top: 0, left: 0, width: SHARE_SIZE.width, height: SHARE_SIZE.height } as const;

  if (photo || seed) {
    const art = placeholderArt(seed ?? "");
    return (
      <div style={{ ...fill, display: "flex" }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- drawn to a PNG, not a page
          <img src={photo} alt="" style={{ ...fill, objectFit: "cover" }} />
        ) : (
          <div style={{ ...fill, backgroundColor: art.base, backgroundImage: art.backgroundImage }} />
        )}
        <div
          style={{
            ...fill,
            backgroundImage:
              "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.35) 100%)",
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ ...fill, display: "flex" }}>
      <div
        style={{
          ...fill,
          backgroundImage: "radial-gradient(circle at 100% 0%, rgba(61,177,255,0.3) 0%, rgba(61,177,255,0) 55%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -330,
          right: -260,
          width: 760,
          height: 760,
          borderRadius: 380,
          border: "2px solid rgba(61,177,255,0.35)",
        }}
      />
    </div>
  );
}
