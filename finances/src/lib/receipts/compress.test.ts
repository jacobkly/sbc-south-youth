import { afterEach, describe, expect, it, vi } from "vitest";
import { RECEIPT_COMPRESSION } from "./compression-config";
import { MAX_RECEIPT_BYTES, ReceiptFileError, extensionFor, processReceipt, targetSize } from "./compress";
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

/**
 * Fake browser canvas. `encodable` lists the types the "browser" can
 * encode; anything else comes back as PNG, like Safari does for WebP.
 */
function stubBrowser(options: { width: number; height: number; encodable: string[] }) {
  const canvases: { width: number; height: number }[] = [];
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
        getContext: () => ctx,
        toBlob: (callback: (blob: Blob | null) => void, type: string) => {
          const produced = options.encodable.includes(type) ? type : "image/png";
          callback(new Blob([new Uint8Array(1234)], { type: produced }));
        },
      };
      canvases.push(canvas);
      return canvas;
    },
  });

  return { bitmap, canvases, ctx };
}

describe("processReceipt with images", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const photo = () => new File([new Uint8Array(3_000_000)], "IMG_0001.jpg", { type: "image/jpeg" });

  it("resizes and encodes WebP when the browser supports it", async () => {
    const { bitmap, canvases } = stubBrowser({ width: 3024, height: 4032, encodable: ["image/webp", "image/jpeg"] });
    const result = await processReceipt(photo());

    expect(result.mimeType).toBe("image/webp");
    expect(result.blob.type).toBe("image/webp");
    expect({ width: result.width, height: result.height }).toEqual({ width: 1500, height: 2000 });
    expect(result.original).toEqual({ size: 3_000_000, type: "image/jpeg", width: 3024, height: 4032 });
    // One halving step (1512x2016), then the final canvas.
    expect(canvases.map((c) => `${c.width}x${c.height}`)).toEqual(["1512x2016", "1500x2000"]);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("falls back to JPEG when WebP quietly comes back as PNG (Safari)", async () => {
    stubBrowser({ width: 3024, height: 4032, encodable: ["image/jpeg"] });
    const result = await processReceipt(photo());

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.blob.type).toBe("image/jpeg");
  });

  it("fails clearly when the browser can encode neither format", async () => {
    stubBrowser({ width: 3024, height: 4032, encodable: [] });
    await expect(processReceipt(photo())).rejects.toThrow(ReceiptFileError);
  });

  it("keeps small images at their original size", async () => {
    const { canvases } = stubBrowser({ width: 800, height: 600, encodable: ["image/webp"] });
    const result = await processReceipt(photo(), RECEIPT_COMPRESSION);

    expect({ width: result.width, height: result.height }).toEqual({ width: 800, height: 600 });
    expect(canvases).toHaveLength(1);
  });

  it("fills a white background so transparent PNGs don't turn black", async () => {
    const { ctx } = stubBrowser({ width: 1000, height: 1000, encodable: ["image/jpeg"] });
    await processReceipt(new File(["png"], "scan.png", { type: "image/png" }));
    expect(ctx.fillStyle).toBe("#ffffff");
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1000, 1000);
  });
});

describe("sha256Hex", () => {
  it("hashes a blob as lowercase hex", async () => {
    await expect(sha256Hex(new Blob(["abc"]))).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
