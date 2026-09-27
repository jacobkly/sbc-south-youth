/**
 * The color theme, picked in Settings and saved on each device. Grey sits on
 * top of dark (`class="dark grey"`), so every `dark:` style still applies and
 * grey only swaps the color tokens in globals.css.
 */

export const THEMES = ["light", "grey", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

/** What's on screen: System turns into light or dark. */
export type Appearance = Exclude<Theme, "system">;

export const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  grey: "Grey",
  dark: "Dark",
  system: "System",
};

export const DEFAULT_THEME: Theme = "light";

/** The localStorage key. */
export const THEME_KEY = "theme";

/** Sent on the window when this tab changes the theme, since `storage` only reaches other tabs. */
export const THEME_EVENT = "themechange";

export type ThemeConfig = {
  key: string;
  themes: readonly string[];
  fallback: Theme;
  /** For the theme-color meta tag, which colors the iOS status bar. Matches `--background`. */
  colors: Record<Appearance, string>;
};

export const THEME_CONFIG: ThemeConfig = {
  key: THEME_KEY,
  themes: THEMES,
  fallback: DEFAULT_THEME,
  colors: { light: "#ffffff", grey: "#262626", dark: "#0a0a0a" },
};

export function parseTheme(value: string | null): Theme {
  return THEMES.find((theme) => theme === value) ?? DEFAULT_THEME;
}

/** The saved theme, or the default when nothing's saved or storage is blocked. */
export function readTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Puts a theme, or the saved one, on `<html>` and the theme-color meta tag.
 * It also runs inline in `<head>` before the first paint, as source text, so
 * it can't use anything from outside itself.
 */
export function applyTheme({ key, themes, fallback, colors }: ThemeConfig, picked?: Theme): void {
  let theme: string | null = picked ?? null;
  if (!theme) {
    try {
      theme = localStorage.getItem(key);
    } catch {
      // Storage can be blocked. The fallback still applies.
    }
  }
  if (!theme || !themes.includes(theme)) theme = fallback;
  const look = (
    theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme
  ) as Appearance;

  const root = document.documentElement;
  root.classList.toggle("dark", look !== "light");
  root.classList.toggle("grey", look === "grey");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colors[look]);
}

/** The `<head>` script that applies the theme before the page first paints. */
export const THEME_SCRIPT = `(${applyTheme.toString()})(${JSON.stringify(THEME_CONFIG)})`;

/** Saves a new theme and applies it, without animating every color at once. */
export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage is blocked: it applies, but only until the page reloads.
  }
  const pause = document.createElement("style");
  pause.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(pause);
  applyTheme(THEME_CONFIG, theme);
  // Settles the new colors before the transitions come back. A timeout, not an
  // animation frame, so it still runs if the tab is hidden.
  void getComputedStyle(document.body).color;
  setTimeout(() => pause.remove(), 1);
  window.dispatchEvent(new Event(THEME_EVENT));
}
