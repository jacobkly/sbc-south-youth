import { describe, expect, it } from "vitest";
import { SLUG_MAX, slugify, uniqueSlug } from "./slug";

/** The database's rule for an event's slug. */
const VALID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe("slugify", () => {
  it("makes lowercase words and dashes from the title", () => {
    expect(slugify("Fall Retreat")).toBe("fall-retreat");
    expect(slugify("  Worship   Night!  ")).toBe("worship-night");
  });

  it("drops apostrophes instead of splitting words on them", () => {
    expect(slugify("Leaders' Night")).toBe("leaders-night");
    expect(slugify("Mom’s Brunch")).toBe("moms-brunch");
  });

  it("spells out & and drops accents", () => {
    expect(slugify("Games & Pizza")).toBe("games-and-pizza");
    expect(slugify("Café Night")).toBe("cafe-night");
  });

  it("falls back to event when the title has no letters or digits it can use", () => {
    expect(slugify("🎉🎉")).toBe("event");
    expect(slugify("Ночь")).toBe("event");
  });

  it("never starts with weekly-, which the weekly nights own", () => {
    expect(slugify("Weekly Pizza")).toBe("event-weekly-pizza");
    expect(slugify("Weekly")).toBe("weekly");
  });

  it("stops at 80 characters, at the end of a word when it can", () => {
    const slug = slugify(`${"Really long ".repeat(10)}title`);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug).toMatch(VALID);
    expect(slug.endsWith("-really")).toBe(true);
  });

  it("cuts one very long word wherever it has to", () => {
    const slug = slugify("a".repeat(120));
    expect(slug).toBe("a".repeat(SLUG_MAX));
  });
});

describe("uniqueSlug", () => {
  it("keeps the title's slug when no other event has it", () => {
    expect(uniqueSlug("worship-night", "2026-11-14", new Set(["fall-retreat"]))).toBe("worship-night");
  });

  it("adds the day it starts when the title's slug is taken", () => {
    expect(uniqueSlug("worship-night", "2026-11-14", new Set(["worship-night"]))).toBe("worship-night-nov-14");
  });

  it("numbers it when that's taken too", () => {
    const taken = new Set(["worship-night", "worship-night-nov-14", "worship-night-nov-14-2"]);
    expect(uniqueSlug("worship-night", "2026-11-14", taken)).toBe("worship-night-nov-14-3");
  });

  it("shortens a long title to fit the suffix", () => {
    const base = slugify(`${"Really long ".repeat(10)}title`);
    const slug = uniqueSlug(base, "2026-11-14", new Set([base]));
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug).toMatch(VALID);
    expect(slug.endsWith("-nov-14")).toBe(true);
  });
});
