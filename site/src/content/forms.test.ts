import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contactTopics } from "./forms";

/** Every `.ts` and `.tsx` file under `dir`, skipping tests. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("contactTopics", () => {
  it("has a topic for every /contact?topic= link on the site", () => {
    const linked = sourceFiles(join(process.cwd(), "src")).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/\/contact\?topic=([a-z-]+)/g)].map((match) => match[1]),
    );
    expect(linked).toContain("parent");
    expect(linked.filter((id) => !Object.hasOwn(contactTopics, id))).toEqual([]);
  });
});
