import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next resolves `server-only` itself and fails the build if a client
      // bundle imports it. Tests run as the server, so it's a no-op here.
      "server-only": fileURLToPath(new URL("./node_modules/next/dist/compiled/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Not Los Angeles, so any accidental use of the machine's local time fails.
    env: { TZ: "Asia/Tokyo" },
  },
});
