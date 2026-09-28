import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Not Los Angeles, so any accidental use of the machine's local time fails.
    env: { TZ: "Asia/Tokyo" },
  },
});
