import { describe, expect, it } from "vitest";
import { fontFileUrl, shareAlt, titleSize } from "./share";

describe("titleSize", () => {
  it("steps down as titles get longer", () => {
    const sizes = ["Say hi.", "Come. Connect. Serve.", "Your privacy, in plain words.", "x".repeat(50), "x".repeat(80)].map(
      titleSize,
    );
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(new Set(sizes).size).toBe(sizes.length);
  });
});

describe("shareAlt", () => {
  it("names the page and its headline", () => {
    expect(shareAlt({ title: "Plan a Visit", heading: "Your first Friday" })).toBe(
      "Plan a Visit at SBC South Youth: Your first Friday",
    );
  });
});

describe("fontFileUrl", () => {
  it("finds a TrueType file", () => {
    const css = `@font-face {
  font-family: 'Geist';
  src: url(https://fonts.gstatic.com/s/geist/v5/abc.ttf) format('truetype');
}`;
    expect(fontFileUrl(css)).toBe("https://fonts.gstatic.com/s/geist/v5/abc.ttf");
  });

  it("skips WOFF2, which the renderer can't read", () => {
    expect(fontFileUrl("src: url(https://fonts.gstatic.com/s/geist/v5/abc.woff2) format('woff2');")).toBeNull();
    expect(fontFileUrl("")).toBeNull();
  });
});
