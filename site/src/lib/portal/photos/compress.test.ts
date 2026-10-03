import { afterEach, describe, expect, it, vi } from "vitest";
import { UnusableFileError } from "@/lib/portal/images/canvas";
import { MAX_PHOTO_BYTES, PHOTO_TARGET_BYTES, processPhoto } from "./compress";

/**
 * Fake browser canvas. `encodable` lists the types the "browser" can
 * encode; anything else comes back as PNG, like Safari does for WebP.
 * `bytes` sets the encoded file size for a canvas width and quality.
 */
function stubBrowser(options: {
  width: number;
  height: number;
  encodable: string[];
  bytes?: (width: number, quality: number) => number;
}) {
  /** Size of each canvas drawn on, in order. */
  const drawn: string[] = [];
  /** Each photo encode, skipping the 1 px format check. */
  const encodes: string[] = [];
  const bitmap = { width: options.width, height: options.height, close: vi.fn() };
  const ctx = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
    fillStyle: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  };

  vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
  vi.stubGlobal("document", {
    createElement: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => {
          drawn.push(`${canvas.width}x${canvas.height}`);
          return ctx;
        },
        toBlob: (callback: (blob: Blob | null) => void, type: string, quality: number) => {
          const produced = options.encodable.includes(type) ? type : "image/png";
          if (canvas.width > 1) encodes.push(`${canvas.width}@${quality}`);
          const bytes = options.bytes?.(canvas.width, quality) ?? 12_000;
          callback(new Blob([new Uint8Array(bytes)], { type: produced }));
        },
      };
      return canvas;
    },
  });

  return { bitmap, drawn, encodes };
}

describe("processPhoto", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const photo = () => new File([new Uint8Array(4_000_000)], "IMG_0001.jpg", { type: "image/jpeg" });
  const both = ["image/webp", "image/jpeg"];

  it("makes a 1600 px and a 640 px WebP from a phone photo", async () => {
    const { bitmap, drawn } = stubBrowser({ width: 4032, height: 3024, encodable: both });

    const result = await processPhoto(photo());

    expect(result).toMatchObject({ mimeType: "image/webp", width: 1600, height: 1200 });
    expect(result.files.lg.type).toBe("image/webp");
    expect(result.files.sm.type).toBe("image/webp");
    // Halved once on the way to the large size. The small size is drawn from the large one.
    expect(drawn).toEqual(["2016x1512", "1600x1200", "800x600", "640x480"]);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("falls back to JPEG when WebP quietly comes back as PNG (Safari)", async () => {
    stubBrowser({ width: 3024, height: 4032, encodable: ["image/jpeg"] });

    const result = await processPhoto(photo());

    expect(result).toMatchObject({ mimeType: "image/jpeg", width: 1200, height: 1600 });
    expect(result.files.lg.type).toBe("image/jpeg");
    expect(result.files.sm.type).toBe("image/jpeg");
  });

  it("lowers the quality, never the size, until each file is near its target", async () => {
    // Grows with pixels and quality, like a real encoder. The large size
    // first fits at 0.56, the small one at 0.72.
    const { encodes } = stubBrowser({
      width: 4000,
      height: 3000,
      encodable: both,
      bytes: (width, quality) => Math.round(width * width * quality * 0.2),
    });

    const result = await processPhoto(photo());

    expect(encodes).toEqual(["1600@0.8", "1600@0.72", "1600@0.64", "1600@0.56", "640@0.8", "640@0.72"]);
    expect(result.files.lg.size).toBeLessThanOrEqual(PHOTO_TARGET_BYTES.lg);
    expect(result.files.sm.size).toBeLessThanOrEqual(PHOTO_TARGET_BYTES.sm);
  });

  it("keeps the lowest quality when nothing reaches the target but the bucket still takes it", async () => {
    const { encodes } = stubBrowser({
      width: 4000,
      height: 3000,
      encodable: both,
      bytes: (width) => (width === 1600 ? PHOTO_TARGET_BYTES.lg + 1 : 1_000),
    });

    const result = await processPhoto(photo());

    expect(encodes.filter((encode) => encode.startsWith("1600@"))).toEqual([
      "1600@0.8",
      "1600@0.72",
      "1600@0.64",
      "1600@0.56",
      "1600@0.5",
    ]);
    expect(result.files.lg.size).toBe(PHOTO_TARGET_BYTES.lg + 1);
  });

  it("rejects a photo that's still over the bucket's limit", async () => {
    stubBrowser({ width: 4000, height: 3000, encodable: both, bytes: () => MAX_PHOTO_BYTES + 1 });

    await expect(processPhoto(photo())).rejects.toThrow(UnusableFileError);
  });

  it("keeps a photo smaller than the large size at its own size", async () => {
    const { drawn } = stubBrowser({ width: 1200, height: 900, encodable: both });

    const result = await processPhoto(photo());

    expect(result).toMatchObject({ width: 1200, height: 900 });
    expect(drawn).toEqual(["1200x900", "640x480"]);
  });

  it("rejects a photo too small to look sharp on the site", async () => {
    const { bitmap } = stubBrowser({ width: 900, height: 600, encodable: both });

    await expect(processPhoto(photo())).rejects.toThrow(/too small/);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("rejects files that aren't photos", async () => {
    const pdf = new File(["%PDF-1.7 fake"], "scan.pdf", { type: "application/pdf" });

    await expect(processPhoto(pdf)).rejects.toThrow("Choose a photo");
  });
});
