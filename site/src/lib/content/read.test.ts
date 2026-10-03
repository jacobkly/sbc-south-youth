import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readOrNothing } from "./read";

const down = () => Promise.reject(new Error("fetch failed"));

describe("readOrNothing", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("passes a good read through", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(readOrNothing("events", () => Promise.resolve([1, 2]))).resolves.toEqual([1, 2]);
  });

  it("gives nothing while building, so the build still finishes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    await expect(readOrNothing("events", down)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/events/), expect.any(Error));
  });

  it("gives nothing in development, so the site runs without the database", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await expect(readOrNothing("heads-ups", down)).resolves.toBeNull();
  });

  it("lets the error stand once the site is running, so the last good page stays up", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    await expect(readOrNothing("events", down)).rejects.toThrow("fetch failed");
    expect(console.error).not.toHaveBeenCalled();
  });
});
