import { describe, expect, it } from "vitest";
import { pages } from "@/content/pages";
import { fullTitle, pageMetadata } from "./metadata";

describe("pageMetadata", () => {
  it("points the canonical URL and the link preview at the page", () => {
    const metadata = pageMetadata(pages.visit);
    expect(metadata.title).toBe("Plan a Visit");
    expect(metadata.alternates?.canonical).toBe("/visit");
    expect(metadata.openGraph).toMatchObject({
      title: "Plan a Visit · SBC South Youth",
      description: pages.visit.description,
      url: "/visit",
      siteName: "SBC South Youth",
    });
  });

  it("leaves the image to the opengraph-image files", () => {
    expect(pageMetadata(pages.give).openGraph).not.toHaveProperty("images");
  });
});

describe("fullTitle", () => {
  it("adds the site name", () => {
    expect(fullTitle("Fall Retreat")).toBe("Fall Retreat · SBC South Youth");
  });
});

describe("pages", () => {
  it("gives every page its own path", () => {
    const paths = Object.values(pages).map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path).toMatch(/^\/[a-z-]+$/);
  });

  it("keeps search descriptions short enough to show whole", () => {
    for (const page of Object.values(pages)) expect(page.description.length).toBeLessThanOrEqual(160);
  });
});
