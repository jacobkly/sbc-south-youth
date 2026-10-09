import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { ICON_TILE, logoSize, PORTAL_ICONS, type PortalIcon } from "./install";

// A local file that never changes, so it's read once when the module loads.
const logo = readFileSync(join(process.cwd(), "src/assets/logo.png"), "base64");

/** A square home screen icon: the logo on a black tile. The phone rounds its corners. */
export function drawIcon(file: PortalIcon): ImageResponse {
  const size = PORTAL_ICONS[file];
  const { width, height } = logoSize(file);
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: ICON_TILE,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- drawn to a PNG, not a page */}
      <img src={`data:image/png;base64,${logo}`} width={width} height={height} alt="" />
    </div>,
    { width: size, height: size },
  );
}
