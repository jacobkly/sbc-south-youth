import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { logoSize } from "./install";
import { THEME_CONFIG } from "./theme";

// A local file that never changes, so it's read once when the module loads.
const logo = readFileSync(join(process.cwd(), "src/assets/logo.png"), "base64");

/**
 * A square home screen icon: the logo on the dark tile the portal's header
 * shows. The phone rounds its corners.
 */
export function drawIcon(size: number): ImageResponse {
  const { width, height } = logoSize(size);
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: THEME_CONFIG.colors.dark,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- drawn to a PNG, not a page */}
      <img src={`data:image/png;base64,${logo}`} width={width} height={height} alt="" />
    </div>,
    { width: size, height: size },
  );
}
