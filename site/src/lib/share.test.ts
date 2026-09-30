import { describe, expect, it } from "vitest";
import { fontFileUrl, shareAlt, sharePhotoUrl, titleSize } from "./share";

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

describe("sharePhotoUrl", () => {
  it("crops Unsplash photos to the preview size as a JPEG", () => {
    const url = new URL(sharePhotoUrl("https://images.unsplash.com/photo-123?w=2400&q=80&auto=format"));
    expect(url.pathname).toBe("/photo-123");
    expect(Object.fromEntries(url.searchParams)).toEqual({ w: "1200", h: "630", fit: "crop", fm: "jpg", q: "75" });
  });

  it("leaves other hosts alone", () => {
    const src = "https://example.supabase.co/storage/v1/object/public/photos/camp.jpg";
    expect(sharePhotoUrl(src)).toBe(src);
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
