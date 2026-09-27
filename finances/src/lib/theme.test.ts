import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, parseTheme, THEME_CONFIG, THEME_KEY, THEME_SCRIPT } from "./theme";

/** Just enough of a page for applyTheme: storage, the dark-mode query, `<html>`, and the meta tag. */
function fakePage({ saved = null, prefersDark = false }: { saved?: string | null | Error; prefersDark?: boolean } = {}) {
  const classes = new Set<string>(["font-sans"]);
  const meta = { content: "#ffffff", setAttribute: (_: string, value: string) => (meta.content = value) };
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => {
      if (saved instanceof Error) throw saved;
      return key === THEME_KEY ? saved : null;
    },
  });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: prefersDark && query === "(prefers-color-scheme: dark)" }));
  vi.stubGlobal("document", {
    documentElement: {
      classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name), on) },
    },
    querySelector: (selector: string) => (selector === 'meta[name="theme-color"]' ? meta : null),
  });
  return { classes, meta };
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
