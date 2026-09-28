import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { qrCode } from "./qr";

const url = "https://cash.app/$ExampleYouth";
const run = /M(\d+) (\d+)h(\d+)v1h-\3z/g;

/** Reads a path back into its dark cells, as "x,y". */
function darkCells(path: string): Set<string> {
  const cells = new Set<string>();
  for (const [, x, y, width] of path.matchAll(run)) {
    for (let i = 0; i < Number(width); i++) cells.add(`${Number(x) + i},${y}`);
  }
  return cells;
}

/** True when the 7×7 block at (left, top) is a finder: a dark ring, a light ring, and a dark center. */
function hasFinder(cells: Set<string>, left: number, top: number): boolean {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
      if (cells.has(`${left + x},${top + y}`) !== (ring !== 2)) return false;
    }
  }
  return true;
}

describe("qrCode", () => {
  it("draws only one-row runs of dark modules", () => {
    const { path } = qrCode(url);
    expect(path).not.toBe("");
    expect(path.replace(run, "")).toBe("");
  });

  it("draws exactly the encoder's dark modules, x as the column and y as the row", () => {
    const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
    const cells = darkCells(qrCode(url, { margin: 0 }).path);

    let dark = 0;
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        const isDark = modules.get(row, col) === 1;
        if (isDark) dark++;
        expect(cells.has(`${col},${row}`), `module at row ${row}, column ${col}`).toBe(isDark);
      }
    }
    expect(cells.size).toBe(dark);
  });

  it("has finders in three corners and none in the fourth", () => {
    const { size, path } = qrCode(url, { margin: 0 });
    const cells = darkCells(path);
    expect(hasFinder(cells, 0, 0)).toBe(true);
    expect(hasFinder(cells, size - 7, 0)).toBe(true);
    expect(hasFinder(cells, 0, size - 7)).toBe(true);
    expect(hasFinder(cells, size - 7, size - 7)).toBe(false);
  });

  it("is a valid QR size: 21 modules plus 4 per version", () => {
    const { size } = qrCode(url, { margin: 0 });
    expect((size - 17) % 4).toBe(0);
    expect(size).toBeGreaterThanOrEqual(21);
  });

  it("keeps a 4-module quiet zone by default, inside the view box", () => {
    const bare = qrCode(url, { margin: 0 });
    const framed = qrCode(url);
    expect(framed.size).toBe(bare.size + 8);

    const cells = darkCells(framed.path);
    expect(hasFinder(cells, 4, 4)).toBe(true);
    for (const cell of cells) {
      const [x, y] = cell.split(",").map(Number);
      expect(x >= 4 && y >= 4 && x < framed.size - 4 && y < framed.size - 4, `cell ${cell}`).toBe(true);
    }
  });
});
