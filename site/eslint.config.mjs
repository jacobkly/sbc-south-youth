import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const PORTAL_ONLY =
  "Only the portal (app/(portal), app/(portal-preview), components/portal, lib/portal) may import this, so it stays out of the public site's bundle.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/(portal)/**", "src/app/(portal-preview)/**", "src/components/portal/**", "src/lib/portal/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "radix-ui", message: PORTAL_ONLY },
            { name: "@/lib/supabase/client", message: PORTAL_ONLY },
          ],
          patterns: [
            {
              group: ["radix-ui/*", "@radix-ui/*", "@/components/portal", "@/components/portal/*", "@/lib/portal", "@/lib/portal/*"],
              message: PORTAL_ONLY,
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
