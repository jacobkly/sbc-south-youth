/**
 * The color theme, picked in Settings. It's saved on the account so it
 * follows the user to every device, and on each device so it applies before
 * the first paint, even on the sign-in page. Grey sits on top of dark
 * (`class="dark grey"`), so every `dark:` style still applies and grey only
 * swaps the color tokens in globals.css.
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

/** A known theme, or null for nothing or anything else. */
export function parseSavedTheme(value: string | null | undefined): Theme | null {
  return THEMES.find((theme) => theme === value) ?? null;
}

export function parseTheme(value: string | null): Theme {
  return parseSavedTheme(value) ?? DEFAULT_THEME;
}

/** This page load's pick, for when storage is blocked. */
let pickedTheme: Theme | null = null;

/** This device's saved theme, or null when it hasn't picked one. */
export function readSavedTheme(): Theme | null {
  try {
    return parseSavedTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return pickedTheme;
  }
}

/** The theme on screen: this device's pick, or the default. */
export function readTheme(): Theme {
  return readSavedTheme() ?? DEFAULT_THEME;
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

/**
 * A script for the signed-in page's HTML: it saves the account's theme on
 * this device and applies it, before the page first paints.
 */
export function accountThemeScript(theme: Theme): string {
  const value = JSON.stringify(theme);
  return `try{localStorage.setItem(${JSON.stringify(THEME_KEY)},${value})}catch(e){};(${applyTheme.toString()})(${JSON.stringify(THEME_CONFIG)},${value})`;
}

/**
 * What to do when a signed-in page loads. The account's theme wins over this
 * device's. A device that picked one before the account had any saves it to
 * the account.
 */
export function reconcileTheme(
  account: Theme | null,
  device: Theme | null,
): { apply: Theme } | { upload: Theme } | null {
  if (account) return account === device ? null : { apply: account };
  return device ? { upload: device } : null;
}

/** Saves a new theme on this device and applies it, without animating every color at once. */
export function saveTheme(theme: Theme): void {
  pickedTheme = theme;
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
