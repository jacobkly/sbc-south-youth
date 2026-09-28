import { qrCode } from "@/lib/qr";

/**
 * A QR code drawn at build time as one SVG path. Always black on white,
 * with its quiet zone built in, so it scans in either theme.
 */
export function QrCode({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const { size, path } = qrCode(value);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges" className={`bg-white ${className}`}>
      <path d={path} fill="#000" />
    </svg>
  );
}
