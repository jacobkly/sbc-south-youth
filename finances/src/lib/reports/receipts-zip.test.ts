import { describe, expect, it } from "vitest";
import { fileNamePart, receiptZipEntries, type ZipReceipt, type ZipRequest } from "./receipts-zip";

const alex: ZipRequest = { id: "a", request_number: 12, purchase_date: "2026-03-14", payee: { full_name: "Alex Example" } };
const sam: ZipRequest = { id: "s", request_number: 3, purchase_date: "2026-02-01", payee: { full_name: "Sam Sample" } };

function receipt(requestId: string, file: string, size = 100): ZipReceipt {
  return { request_id: requestId, storage_path: `${requestId}/${file}`, size_bytes: size };
}

describe("receiptZipEntries", () => {
  it("names each file by request, date, payee, and its place in the request", () => {
    const entries = receiptZipEntries(
      [alex, sam],
      [receipt("a", "r1.webp", 300), receipt("s", "r2.pdf", 200), receipt("a", "r3.JPG", 100)],
    );
    expect(entries).toEqual([
      { path: "s/r2.pdf", name: "R-0003_2026-02-01_Sam Sample_1.pdf", size: 200 },
      { path: "a/r1.webp", name: "R-0012_2026-03-14_Alex Example_1.webp", size: 300 },
      { path: "a/r3.JPG", name: "R-0012_2026-03-14_Alex Example_2.jpg", size: 100 },
    ]);
  });

  it("skips requests without receipts and receipts outside the report", () => {
    expect(receiptZipEntries([alex, sam], [receipt("x", "r1.webp"), receipt("s", "r2.pdf")]).map((entry) => entry.name)).toEqual([
      "R-0003_2026-02-01_Sam Sample_1.pdf",
    ]);
  });

  it("names a missing payee", () => {
    expect(receiptZipEntries([{ ...alex, payee: null }], [receipt("a", "r1.webp")])[0].name).toBe(
      "R-0012_2026-03-14_Unknown payee_1.webp",
    );
  });

  it("is empty with no receipts", () => {
    expect(receiptZipEntries([alex], [])).toEqual([]);
  });
});

describe("fileNamePart", () => {
  it("replaces characters file systems refuse", () => {
    expect(fileNamePart('Pat "PJ" Example / Youth: A|B?')).toBe("Pat PJ Example Youth A B");
  });

  it("drops trailing dots and collapses spaces", () => {
    expect(fileNamePart("  Sam   Sample Jr.  ")).toBe("Sam Sample Jr");
  });

  it("keeps accents and caps the length", () => {
    expect(fileNamePart("José Ñúñez")).toBe("José Ñúñez");
    expect(fileNamePart("x".repeat(80))).toHaveLength(60);
  });

  it("falls back when nothing is left", () => {
    expect(fileNamePart("???")).toBe("Unknown payee");
    expect(fileNamePart("")).toBe("Unknown payee");
  });
});
