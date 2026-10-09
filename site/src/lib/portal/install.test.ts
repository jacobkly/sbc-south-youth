import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isPortalIcon, LOGO, logoSize, PORTAL_ICONS, portalManifest } from "./install";
import { THEME_CONFIG } from "./theme";

describe("portalManifest", () => {
  const manifest = portalManifest();

  it("opens the portal's Home full screen", () => {
    expect(manifest).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone" });
  });

  it("has a short name that fits under a home screen icon", () => {
    expect(manifest.name).toBe("SBC South Youth Portal");
    expect(manifest.short_name).toBe("Youth Portal");
    expect(manifest.short_name?.length).toBeLessThanOrEqual(12);
  });

  it("opens in the portal's default light theme", () => {
    expect(manifest.background_color).toBe(THEME_CONFIG.colors.light);
    expect(manifest.theme_color).toBe(THEME_CONFIG.colors.light);
  });

  it("names only icons the portal serves, at their real sizes", () => {
    for (const icon of manifest.icons ?? []) {
      const file = icon.src.replace(/^\//, "");
      expect(isPortalIcon(file)).toBe(true);
      if (!isPortalIcon(file)) continue;
      expect(icon.sizes).toBe(`${PORTAL_ICONS[file]}x${PORTAL_ICONS[file]}`);
      expect(icon.type).toBe("image/png");
    }
  });

  it("has the two sizes Android asks for, and one it can crop to a circle", () => {
    const sizes = (manifest.icons ?? []).map((icon) => `${icon.sizes} ${icon.purpose ?? "any"}`);

    expect(sizes).toEqual(expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]));
  });
});

describe("isPortalIcon", () => {
  it.each(["icon.png", "apple-icon.png", "icon-512.png"])("knows %s", (file) => {
    expect(isPortalIcon(file)).toBe(true);
  });

  it.each(["favicon.ico", "icon-1024.png", "", "toString", "__proto__", "constructor"])("refuses %j", (file) => {
    expect(isPortalIcon(file)).toBe(false);
  });
});

describe("logoSize", () => {
  it("knows the logo file's real size", () => {
    // A PNG's width and height sit right after its signature and header name.
    const png = readFileSync(join(process.cwd(), "src/assets/logo.png"));

    expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual(LOGO);
  });

  it.each(Object.keys(PORTAL_ICONS).filter(isPortalIcon))("keeps the logo's shape on %s", (file) => {
    const { width, height } = logoSize(file);

    expect(Math.abs(width / height - LOGO.width / LOGO.height)).toBeLessThan(0.01);
  });

  const maskable = (portalManifest().icons ?? []).filter((icon) => icon.purpose === "maskable");

  it.each(maskable.map((icon) => icon.src.replace(/^\//, "")).filter(isPortalIcon))(
    "keeps the logo on %s inside the circle a mask keeps",
    (file) => {
      const size = PORTAL_ICONS[file];
      const { width, height } = logoSize(file);
      // Android may crop a maskable icon to a circle 80% as wide as the icon.
      const corner = Math.hypot(width / 2, height / 2);

      expect(corner).toBeLessThanOrEqual(size * 0.4);
      expect(height).toBeGreaterThanOrEqual(size * 0.5);
    },
  );

  it("has a maskable icon to check", () => {
    expect(maskable).not.toHaveLength(0);
  });

  // Finances' and the public site's apple-icon.png and icon.png, measured, so
  // the apps match side by side on a home screen and in browser tabs.
  it.each([
    ["apple-icon.png", { width: 120, height: 130 }],
    ["icon.png", { width: 142, height: 154 }],
  ] as const)("draws the logo on %s as big as finances' does", (file, size) => {
    expect(logoSize(file)).toEqual(size);
  });
});
