import QRCode from "qrcode";

export type QrCode = {
  /** The width and height in modules, quiet zone included, for the view box. */
  size: number;
  /** One SVG path that fills every dark module. */
  path: string;
};

/**
 * Encodes text as a QR code and draws it as a single SVG path, one
 * rectangle per run of dark modules in a row, so a page can render it
 * as plain JSX at build time. The quiet zone scanners need is part of
 * the view box, so the code stays scannable at any size.
 */
export function qrCode(text: string, { margin = 4 }: { margin?: number } = {}): QrCode {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const count = modules.size;
  const runs: string[] = [];

  for (let row = 0; row < count; row++) {
    let col = 0;
    while (col < count) {
      if (modules.get(row, col) !== 1) {
        col++;
        continue;
      }
      const start = col;
      while (col < count && modules.get(row, col) === 1) col++;
      const width = col - start;
      runs.push(`M${start + margin} ${row + margin}h${width}v1h-${width}z`);
    }
  }

  return { size: count + margin * 2, path: runs.join("") };
}
