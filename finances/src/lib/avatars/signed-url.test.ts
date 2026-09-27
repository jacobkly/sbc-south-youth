import { describe, expect, it, vi } from "vitest";
import { AVATAR_URL_SECONDS, createAvatarUrlCache } from "./signed-url";

const PATH = "00000000-0000-4000-8000-00000000a001/p1.webp";

describe("createAvatarUrlCache", () => {
  it("signs a path once and reuses the link", async () => {
    const sign = vi.fn(async (path: string) => `https://storage.test/${path}?token=1`);
    const cache = createAvatarUrlCache(sign, () => 0);

    const [first, second] = await Promise.all([cache.get(PATH), cache.get(PATH)]);

    expect(first).toBe(`https://storage.test/${PATH}?token=1`);
    expect(second).toBe(first);
    expect(sign).toHaveBeenCalledTimes(1);
    expect(cache.peek(PATH)).toBe(first);
  });

  it("signs again well before the link expires", async () => {
    let now = 0;
    const sign = vi.fn(async () => `https://storage.test/p1?signed=${now}`);
    const cache = createAvatarUrlCache(sign, () => now);
    await cache.get(PATH);

    now = (AVATAR_URL_SECONDS - 11 * 60) * 1000;
    await cache.get(PATH);
    expect(sign).toHaveBeenCalledTimes(1);

    now = (AVATAR_URL_SECONDS - 10 * 60) * 1000;
    await expect(cache.get(PATH)).resolves.toBe(`https://storage.test/p1?signed=${now}`);
    expect(sign).toHaveBeenCalledTimes(2);
  });

  it("tries again after a link couldn't be made", async () => {
    const sign = vi.fn(async (): Promise<string | null> => null);
    const cache = createAvatarUrlCache(sign, () => 0);

    await expect(cache.get(PATH)).resolves.toBeNull();
    sign.mockResolvedValueOnce("https://storage.test/p1");

    await expect(cache.get(PATH)).resolves.toBe("https://storage.test/p1");
  });

  it("treats a thrown error as no link", async () => {
    const cache = createAvatarUrlCache(async () => Promise.reject(new Error("offline")), () => 0);

    await expect(cache.get(PATH)).resolves.toBeNull();
    expect(cache.peek(PATH)).toBeUndefined();
  });

  it("shows a just-saved picture from its local copy without signing", async () => {
    const sign = vi.fn(async () => "https://storage.test/p1");
    const cache = createAvatarUrlCache(sign, () => 0);

    cache.prime(PATH, "blob:local-copy");

    expect(cache.peek(PATH)).toBe("blob:local-copy");
    await expect(cache.get(PATH)).resolves.toBe("blob:local-copy");
    expect(sign).not.toHaveBeenCalled();
  });
});
