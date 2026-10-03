import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: fileURLToPath(new URL("../..", import.meta.url)) });

/** The import rules' messages for a file with this source at this path. */
async function importErrors(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports").map((m) => m.message);
}

describe("the portal fence", () => {
  it("stops a public component from importing radix-ui or the portal kit", async () => {
    const code = [
      'import { Dialog } from "radix-ui";',
      'import { Button } from "@/components/portal/ui/button";',
      "export const parts = [Dialog, Button];",
    ].join("\n");
    const errors = await importErrors(code, "src/components/site/fake.tsx");
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/Only the portal/);
  }, 30_000);

  it("lets portal code import them", async () => {
    const code = [
      'import { Dialog } from "radix-ui";',
      'import { Button } from "@/components/portal/ui/button";',
      "export const parts = [Dialog, Button];",
    ].join("\n");
    expect(await importErrors(code, "src/components/portal/fake.tsx")).toEqual([]);
    expect(await importErrors(code, "src/app/(portal)/portal/fake/page.tsx")).toEqual([]);
    expect(await importErrors(code, "src/app/(portal-preview)/portal/preview/page.tsx")).toEqual([]);
  }, 30_000);
});
