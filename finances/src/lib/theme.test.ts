import { afterEach, describe, expect, it, vi } from "vitest";
import {
  accountThemeScript,
  applyTheme,
  parseSavedTheme,
  parseTheme,
  readSavedTheme,
  reconcileTheme,
  THEME_CONFIG,
  THEME_KEY,
  THEME_SCRIPT,
} from "./theme";

/**
 * Just enough of a page for the theme code: storage, the dark-mode query,
 * `<html>`, the meta tag, and what saveTheme touches.
 */
function fakePage({ saved = null, prefersDark = false }: { saved?: string | null | Error; prefersDark?: boolean } = {}) {
  const classes = new Set<string>(["font-sans"]);
  const meta = { content: "#ffffff", setAttribute: (_: string, value: string) => (meta.content = value) };
  const stored = new Map<string, string>(typeof saved === "string" ? [[THEME_KEY, saved]] : []);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => {
      if (saved instanceof Error) throw saved;
      return stored.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (saved instanceof Error) throw saved;
      stored.set(key, value);
    },
  });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: prefersDark && query === "(prefers-color-scheme: dark)" }));
  vi.stubGlobal("document", {
    documentElement: {
      classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name), on) },
    },
    querySelector: (selector: string) => (selector === 'meta[name="theme-color"]' ? meta : null),
    createElement: () => ({ textContent: "", remove: () => {} }),
    head: { appendChild: () => {} },
    body: {},
  });
  vi.stubGlobal("getComputedStyle", () => ({ color: "" }));
  vi.stubGlobal("window", { dispatchEvent: () => true });
  return { classes, meta, stored };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseTheme", () => {
  it("keeps a known theme and falls back to light for anything else", () => {
    expect(parseTheme("grey")).toBe("grey");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("purple")).toBe("light");
    expect(parseTheme(null)).toBe("light");
  });
});

describe("applyTheme", () => {
  it("leaves light as it is when nothing's saved", () => {
    const page = fakePage();
    applyTheme(THEME_CONFIG);
    expect([...page.classes]).toEqual(["font-sans"]);
    expect(page.meta.content).toBe("#ffffff");
  });

  it("puts dark, and grey on top of dark, on <html>", () => {
    const dark = fakePage({ saved: "dark" });
    applyTheme(THEME_CONFIG);
    expect([...dark.classes]).toEqual(["font-sans", "dark"]);
    expect(dark.meta.content).toBe(THEME_CONFIG.colors.dark);

    const grey = fakePage({ saved: "grey" });
    applyTheme(THEME_CONFIG);
    expect([...grey.classes]).toEqual(["font-sans", "dark", "grey"]);
    expect(grey.meta.content).toBe(THEME_CONFIG.colors.grey);
  });

  it("follows the device for system", () => {
    const night = fakePage({ saved: "system", prefersDark: true });
    applyTheme(THEME_CONFIG);
    expect(night.classes.has("dark")).toBe(true);

    const day = fakePage({ saved: "system", prefersDark: false });
    applyTheme(THEME_CONFIG);
    expect(day.classes.has("dark")).toBe(false);
  });

  it("takes both classes off when switching from grey to light", () => {
    const page = fakePage({ saved: "grey" });
    applyTheme(THEME_CONFIG);
    applyTheme(THEME_CONFIG, "light");
    expect([...page.classes]).toEqual(["font-sans"]);
    expect(page.meta.content).toBe("#ffffff");
  });

  it("falls back to light for an unknown value or blocked storage", () => {
    const junk = fakePage({ saved: "purple" });
    applyTheme(THEME_CONFIG);
    expect(junk.classes.has("dark")).toBe(false);

    const blocked = fakePage({ saved: new Error("SecurityError") });
    applyTheme(THEME_CONFIG);
    expect(blocked.classes.has("dark")).toBe(false);
  });

  it("applies a picked theme even when storage is blocked", () => {
    const page = fakePage({ saved: new Error("SecurityError") });
    applyTheme(THEME_CONFIG, "dark");
    expect(page.classes.has("dark")).toBe(true);
  });
});

describe("THEME_SCRIPT", () => {
  it("runs on its own, with nothing from this module", () => {
    const page = fakePage({ saved: "grey" });
    new Function(THEME_SCRIPT)();
    expect([...page.classes]).toEqual(["font-sans", "dark", "grey"]);
    expect(page.meta.content).toBe(THEME_CONFIG.colors.grey);
  });
});

describe("parseSavedTheme", () => {
  it("keeps a known theme and gives null for nothing or anything else", () => {
    expect(parseSavedTheme("dark")).toBe("dark");
    expect(parseSavedTheme("purple")).toBeNull();
    expect(parseSavedTheme(null)).toBeNull();
    expect(parseSavedTheme(undefined)).toBeNull();
  });
});

describe("readSavedTheme", () => {
  it("reads this device's pick", () => {
    fakePage({ saved: "grey" });
    expect(readSavedTheme()).toBe("grey");
  });

  it("gives null when this device hasn't picked one", () => {
    fakePage();
    expect(readSavedTheme()).toBeNull();
    fakePage({ saved: "purple" });
    expect(readSavedTheme()).toBeNull();
  });

  it("remembers a pick for the rest of the page load when storage is blocked", async () => {
    vi.resetModules();
    const theme = await import("./theme");
    fakePage({ saved: new Error("SecurityError") });
    expect(theme.readSavedTheme()).toBeNull();

    theme.saveTheme("dark");

    expect(theme.readSavedTheme()).toBe("dark");
    expect(theme.readTheme()).toBe("dark");
  });
});

describe("accountThemeScript", () => {
  it("saves the account's theme on this device and applies it, over the device's own", () => {
    const page = fakePage({ saved: "light" });
    new Function(accountThemeScript("grey"))();
    expect(page.stored.get(THEME_KEY)).toBe("grey");
    expect([...page.classes]).toEqual(["font-sans", "dark", "grey"]);
    expect(page.meta.content).toBe(THEME_CONFIG.colors.grey);
  });

  it("still applies it when storage is blocked", () => {
    const page = fakePage({ saved: new Error("SecurityError") });
    new Function(accountThemeScript("dark"))();
    expect(page.classes.has("dark")).toBe(true);
  });
});

describe("reconcileTheme", () => {
  it("applies the account's theme when this device shows something else", () => {
    expect(reconcileTheme("dark", "light")).toEqual({ apply: "dark" });
    expect(reconcileTheme("grey", null)).toEqual({ apply: "grey" });
  });

  it("does nothing when they already match", () => {
    expect(reconcileTheme("system", "system")).toBeNull();
  });

  it("saves this device's pick to an account that has none", () => {
    expect(reconcileTheme(null, "grey")).toEqual({ upload: "grey" });
  });

  it("does nothing when neither has picked one", () => {
    expect(reconcileTheme(null, null)).toBeNull();
  });
});
