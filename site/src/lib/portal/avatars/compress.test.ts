import { afterEach, describe, expect, it, vi } from "vitest";
import { UnusableFileError } from "@/lib/portal/images/canvas";
import { AVATAR_TARGET_BYTES, MAX_AVATAR_BYTES, avatarAttempts, processAvatar, squareCrop } from "./compress";

describe("squareCrop", () => {
  it("takes the middle of a landscape photo", () => {
    expect(squareCrop(4032, 3024)).toEqual({ x: 504, y: 0, width: 3024, height: 3024 });
  });

  it("takes the middle of a portrait photo", () => {
    expect(squareCrop(3024, 4032)).toEqual({ x: 0, y: 504, width: 3024, height: 3024 });
  });

  it("keeps a square photo whole", () => {
    expect(squareCrop(500, 500)).toEqual({ x: 0, y: 0, width: 500, height: 500 });
  });

  it("lands on whole pixels when the difference is odd", () => {
    expect(squareCrop(101, 100)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(squareCrop(100, 103)).toEqual({ x: 0, y: 1, width: 100, height: 100 });
  });

  it("rejects empty sizes", () => {
    expect(() => squareCrop(0, 100)).toThrow(RangeError);
  });
});

describe("avatarAttempts", () => {
  const labels = (width: number, height: number) =>
    avatarAttempts(width, height).map((attempt) => `${attempt.size}@${attempt.quality}`);

  it("tries every quality at 256 px, then at each smaller size", () => {
    expect(labels(4032, 3024)).toEqual([
      "256@0.8",
      "256@0.7",
      "256@0.6",
      "256@0.5",
      "192@0.8",
      "192@0.7",
      "192@0.6",
      "192@0.5",
      "128@0.8",
      "128@0.7",
      "128@0.6",
      "128@0.5",
    ]);
  });

  it("never upscales, and skips sizes that wouldn't shrink the picture", () => {
    expect(labels(150, 400).filter((label) => label.endsWith("@0.8"))).toEqual(["150@0.8", "128@0.8"]);
    expect(labels(100, 100).filter((label) => label.endsWith("@0.8"))).toEqual(["100@0.8"]);
  });
});

/**
 * Fake browser canvas. `encodable` lists the types the "browser" can
 * encode; anything else comes back as PNG, like Safari does for WebP.
 * `bytes` sets the encoded file size for a canvas size and quality.
 */
function stubBrowser(options: {
  width: number;
  height: number;
  encodable: string[];
  bytes?: (size: number, quality: number) => number;
}) {
  /** Size of each canvas drawn on, in order. */
  const drawn: string[] = [];
  /** Each picture encode, skipping the 1 px format check. */
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

  return { bitmap, ctx, drawn, encodes };
}

describe("processAvatar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const photo = () => new File([new Uint8Array(4_000_000)], "IMG_0001.jpg", { type: "image/jpeg" });
  const both = ["image/webp", "image/jpeg"];

  it("crops a big photo to a 256 px square WebP", async () => {
    const { bitmap, ctx, drawn } = stubBrowser({ width: 4000, height: 3000, encodable: both });

    const result = await processAvatar(photo());

    expect(result).toMatchObject({ mimeType: "image/webp", size: 256, quality: 0.8 });
    expect(result.blob.type).toBe("image/webp");
    // The middle 3000 px square, halved down, then drawn at 256 px.
    expect(ctx.drawImage.mock.calls[0]).toEqual([bitmap, 500, 0, 3000, 3000, 0, 0, 1500, 1500]);
    expect(drawn).toEqual(["1500x1500", "750x750", "375x375", "256x256"]);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("falls back to JPEG when WebP quietly comes back as PNG (Safari)", async () => {
    stubBrowser({ width: 3024, height: 4032, encodable: ["image/jpeg"] });

    const result = await processAvatar(photo());

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.blob.type).toBe("image/jpeg");
  });

  it("lowers the quality, then the size, until the picture is under 30 KB", async () => {
    // Grows with pixels and quality, like a real encoder. 256 px is over
    // the target even at 0.5; 192 px first fits at 0.6.
    const { encodes } = stubBrowser({
      width: 3000,
      height: 3000,
      encodable: both,
      bytes: (size, quality) => Math.round(size * size * quality * 1.3),
    });

    const result = await processAvatar(photo());

    expect(result).toMatchObject({ size: 192, quality: 0.6 });
    expect(result.blob.size).toBeLessThanOrEqual(AVATAR_TARGET_BYTES);
    expect(encodes).toEqual(["256@0.8", "256@0.7", "256@0.6", "256@0.5", "192@0.8", "192@0.7", "192@0.6"]);
  });

  it("keeps the smallest try when nothing reaches 30 KB but it still fits the bucket", async () => {
    stubBrowser({ width: 3000, height: 3000, encodable: both, bytes: () => AVATAR_TARGET_BYTES + 1 });

    const result = await processAvatar(photo());

    expect(result).toMatchObject({ size: 128, quality: 0.5 });
  });

  it("rejects a picture that's still over the bucket limit", async () => {
    stubBrowser({ width: 3000, height: 3000, encodable: both, bytes: () => MAX_AVATAR_BYTES + 1 });

    await expect(processAvatar(photo())).rejects.toThrow(UnusableFileError);
  });

  it("rejects files that aren't photos", async () => {
    const pdf = new File(["%PDF-1.7 fake"], "scan.pdf", { type: "application/pdf" });

    await expect(processAvatar(pdf)).rejects.toThrow("Choose a photo");
  });
});
