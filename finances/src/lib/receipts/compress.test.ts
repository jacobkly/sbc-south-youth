import { afterEach, describe, expect, it, vi } from "vitest";
import { RECEIPT_COMPRESSION } from "./compression-config";
import {
  MAX_RECEIPT_BYTES,
  ReceiptFileError,
  compressionAttempts,
  extensionFor,
  processReceipt,
  targetSize,
  type CompressionAttempt,
} from "./compress";
import { sha256Hex } from "./hash";

const limits = { shortEdge: 1500, maxLongEdge: 4000 };

describe("targetSize", () => {
  it("scales a phone photo so the short edge hits the target", () => {
    expect(targetSize(3024, 4032, limits)).toEqual({ width: 1500, height: 2000 });
    expect(targetSize(4032, 3024, limits)).toEqual({ width: 2000, height: 1500 });
  });

  it("caps the long edge on very long receipts", () => {
    // Short edge would be 1500, but the long edge would then be 7500.
    expect(targetSize(2000, 10000, limits)).toEqual({ width: 800, height: 4000 });
  });

  it("never upscales small images", () => {
    expect(targetSize(800, 600, limits)).toEqual({ width: 800, height: 600 });
    expect(targetSize(1500, 2000, limits)).toEqual({ width: 1500, height: 2000 });
  });

  it("keeps at least 1 px on extreme aspect ratios", () => {
    expect(targetSize(2, 100000, limits)).toEqual({ width: 1, height: 4000 });
  });

  it("rejects empty sizes", () => {
    expect(() => targetSize(0, 100, limits)).toThrow(RangeError);
  });
});

describe("extensionFor", () => {
  it("maps each receipt type to its storage extension", () => {
    expect(extensionFor("image/webp")).toBe("webp");
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("application/pdf")).toBe("pdf");
  });
});

describe("processReceipt with PDFs and non-images", () => {
  it("passes PDFs through untouched", async () => {
    const pdf = new File(["%PDF-1.7 fake"], "receipt.pdf", { type: "application/pdf" });
    const result = await processReceipt(pdf);
    expect(result.blob).toBe(pdf);
    expect(result.mimeType).toBe("application/pdf");
    expect(result.width).toBeNull();
  });

  it("rejects PDFs over the bucket limit", async () => {
    const big = new File([new Uint8Array(MAX_RECEIPT_BYTES + 1)], "big.pdf", { type: "application/pdf" });
    await expect(processReceipt(big)).rejects.toThrow(ReceiptFileError);
  });

  it("rejects files that aren't photos or PDFs", async () => {
    const doc = new File(["hi"], "notes.txt", { type: "text/plain" });
    await expect(processReceipt(doc)).rejects.toThrow("Receipts must be a photo or a PDF.");
  });
});

describe("compressionAttempts", () => {
  const settings = {
    ...RECEIPT_COMPRESSION,
    shortEdge: 1500,
    maxLongEdge: 4000,
    lowerQualities: [0.7, 0.6, 0.5],
    smallerShortEdges: [1200, 1000],
  };
  const labels = (attempts: CompressionAttempt[]) => attempts.map((a) => `${a.width}x${a.height}@${a.quality}`);

  it("tries every quality at full size, then at each smaller size", () => {
    expect(labels(compressionAttempts(3024, 4032, settings, 0.82))).toEqual([
      "1500x2000@0.82",
      "1500x2000@0.7",
      "1500x2000@0.6",
      "1500x2000@0.5",
      "1200x1600@0.82",
      "1200x1600@0.7",
      "1200x1600@0.6",
      "1200x1600@0.5",
      "1000x1333@0.82",
      "1000x1333@0.7",
      "1000x1333@0.6",
      "1000x1333@0.5",
    ]);
  });

  it("skips lower qualities that aren't below the starting quality", () => {
    expect(labels(compressionAttempts(800, 600, settings, 0.6))).toEqual(["800x600@0.6", "800x600@0.5"]);
  });

  it("skips smaller sizes that wouldn't shrink the image", () => {
    expect(labels(compressionAttempts(1100, 1400, { ...settings, lowerQualities: [] }, 0.82))).toEqual([
      "1100x1400@0.82",
      "1000x1273@0.82",
    ]);
  });

  it("keeps long receipts at the long-edge cap", () => {
    expect(labels(compressionAttempts(2000, 10000, { ...settings, lowerQualities: [] }, 0.82))).toEqual(["800x4000@0.82"]);
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
  bytes?: (width: number, height: number, quality: number) => number;
}) {
  /** Size of each canvas drawn on, in order. */
  const drawn: string[] = [];
  /** Each photo encode, skipping the 1 px format check. */
  const encodes: { size: string; type: string; quality: number }[] = [];
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
          if (canvas.width > 1) encodes.push({ size: `${canvas.width}x${canvas.height}`, type, quality });
          const bytes = options.bytes?.(canvas.width, canvas.height, quality) ?? 1234;
          callback(new Blob([new Uint8Array(bytes)], { type: produced }));
        },
      };
      return canvas;
    },
  });

  return { bitmap, drawn, encodes, ctx };
}

describe("processReceipt with images", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const photo = () => new File([new Uint8Array(3_000_000)], "IMG_0001.jpg", { type: "image/jpeg" });
  const both = ["image/webp", "image/jpeg"];

  it("resizes and encodes WebP when the browser supports it", async () => {
    const { bitmap, drawn } = stubBrowser({ width: 3024, height: 4032, encodable: both });
    const result = await processReceipt(photo());

    expect(result.mimeType).toBe("image/webp");
    expect(result.blob.type).toBe("image/webp");
    expect({ width: result.width, height: result.height, quality: result.quality }).toEqual({
      width: 1500,
      height: 2000,
      quality: RECEIPT_COMPRESSION.quality,
    });
    expect(result.original).toEqual({ size: 3_000_000, type: "image/jpeg", width: 3024, height: 4032 });
    // One halving step (1512x2016), then the final canvas.
    expect(drawn).toEqual(["1512x2016", "1500x2000"]);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("falls back to JPEG when WebP quietly comes back as PNG (Safari)", async () => {
    stubBrowser({ width: 3024, height: 4032, encodable: ["image/jpeg"] });
    const result = await processReceipt(photo());

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.blob.type).toBe("image/jpeg");
    expect(result.quality).toBe(RECEIPT_COMPRESSION.jpegFallbackQuality);
  });

  it("fails clearly when the browser can encode neither format", async () => {
    stubBrowser({ width: 3024, height: 4032, encodable: [] });
    await expect(processReceipt(photo())).rejects.toThrow(ReceiptFileError);
  });

  it("keeps small images at their original size", async () => {
    const { drawn } = stubBrowser({ width: 800, height: 600, encodable: ["image/webp"] });
    const result = await processReceipt(photo(), RECEIPT_COMPRESSION);

    expect({ width: result.width, height: result.height }).toEqual({ width: 800, height: 600 });
    expect(drawn).toEqual(["800x600"]);
  });

  it("fills a white background so transparent PNGs don't turn black", async () => {
    const { ctx } = stubBrowser({ width: 1000, height: 1000, encodable: ["image/jpeg"] });
    await processReceipt(new File(["png"], "scan.png", { type: "image/png" }));
    expect(ctx.fillStyle).toBe("#ffffff");
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1000, 1000);
  });

  describe("fitting the target size", () => {
    const target = RECEIPT_COMPRESSION.targetBytes;

    it("encodes once when the first try fits", async () => {
      const { encodes } = stubBrowser({ width: 3024, height: 4032, encodable: both, bytes: () => target });
      const result = await processReceipt(photo());

      expect(result.quality).toBe(RECEIPT_COMPRESSION.quality);
      expect(encodes).toHaveLength(1);
    });

    it("lowers the quality until the file fits", async () => {
      const { drawn } = stubBrowser({
        width: 3024,
        height: 4032,
        encodable: both,
        bytes: (_width, _height, quality) => (quality > 0.65 ? 2 * target : target - 1),
      });
      const result = await processReceipt(photo());

      expect({ width: result.width, height: result.height, quality: result.quality }).toEqual({
        width: 1500,
        height: 2000,
        quality: 0.6,
      });
      expect(result.blob.size).toBe(target - 1);
      // Every quality reuses the same drawing.
      expect(drawn).toEqual(["1512x2016", "1500x2000"]);
    });

    it("shrinks the image when no quality fits at full size", async () => {
      // Grows with pixels and quality, like a real encoder. At 1500x2000 even
      // 0.5 is 600,000 bytes; 1200x1600 first fits at 0.6 (460,800 bytes).
      const { drawn } = stubBrowser({
        width: 3024,
        height: 4032,
        encodable: both,
        bytes: (width, height, quality) => Math.round(width * height * quality * 0.4),
      });
      const result = await processReceipt(photo());

      expect({ width: result.width, height: result.height, quality: result.quality }).toEqual({
        width: 1200,
        height: 1600,
        quality: 0.6,
      });
      expect(result.blob.size).toBeLessThanOrEqual(target);
      expect(drawn).toEqual(["1512x2016", "1500x2000", "1512x2016", "1200x1600"]);
    });

    it("keeps the smallest try when nothing fits", async () => {
      const { encodes } = stubBrowser({ width: 3024, height: 4032, encodable: both, bytes: () => 2 * target });
      const result = await processReceipt(photo());

      expect({ width: result.width, height: result.height, quality: result.quality }).toEqual({
        width: 1000,
        height: 1333,
        quality: 0.5,
      });
      expect(encodes).toHaveLength(12);
    });

    it("steps down from the JPEG quality when WebP isn't available (Safari)", async () => {
      const { encodes } = stubBrowser({
        width: 3024,
        height: 4032,
        encodable: ["image/jpeg"],
        bytes: (_width, _height, quality) => (quality > 0.8 ? 2 * target : target),
      });
      const result = await processReceipt(photo());

      expect(result.mimeType).toBe("image/jpeg");
      expect(encodes).toEqual([
        { size: "1500x2000", type: "image/jpeg", quality: RECEIPT_COMPRESSION.jpegFallbackQuality },
        { size: "1500x2000", type: "image/jpeg", quality: 0.7 },
      ]);
    });
  });
});

describe("sha256Hex", () => {
  it("hashes a blob as lowercase hex", async () => {
    await expect(sha256Hex(new Blob(["abc"]))).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
