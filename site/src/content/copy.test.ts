import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { home } from "./home";
import { pages } from "./pages";
import { gatherings } from "./schedule";

/** Every `.ts` and `.tsx` file under `dir`, skipping tests and local-only dev pages. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "dev" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const files = sourceFiles(join(process.cwd(), "src")).map((path) => ({ path, text: readFileSync(path, "utf8") }));

describe("site copy", () => {
  it("never ends a heading in a period", () => {
    const headings = [...Object.values(pages).map((page) => page.heading), home.hero.title, home.highlights.title];
    expect(headings.filter((heading) => heading.endsWith("."))).toEqual([]);

    // Plain text written straight into a heading tag, like <h1>Wrong room.</h1>.
    const literal = files.flatMap(({ text }) =>
      [...text.matchAll(/<h[1-6][^>]*>\s*([^<{]+?)\s*<\/h[1-6]>/g)].map((match) => match[1]),
    );
    expect(literal.filter((heading) => heading.endsWith("."))).toEqual([]);
  });

  it("leaves out the filler words", () => {
    const filler = /\bsorted\b|\bjourney\b|\bvibrant\b|\bcommunity\b|don't miss a thing|everything you need|fuel the mission/i;
    expect(files.filter(({ text }) => filler.test(text)).map(({ path }) => path)).toEqual([]);
  });

  it("puts the real Friday start time in the home headline", () => {
    const friday = gatherings.find((gathering) => gathering.weekday === 5);
    const [hours, minutes] = (friday?.startTime ?? "").split(":").map(Number);
    expect(home.hero.title).toBe(`Fridays at ${hours % 12 || 12}:${String(minutes).padStart(2, "0")}`);
  });
});
