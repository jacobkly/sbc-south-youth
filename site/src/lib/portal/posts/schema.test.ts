import { describe, expect, it } from "vitest";
import { laInstant } from "@/lib/dates";
import { checkPost, fromLocalInput, toLocalInput } from "./schema";

// Wednesday, October 7, 2026 at 3 PM in Los Angeles.
const now = laInstant("2026-10-07", "15:00");

const valid = {
  title: "No youth tonight",
  body: "We're taking the night off.",
  linkUrl: "",
  linkLabel: "",
  tone: "cancellation",
  pinned: true,
  startsAt: "",
  endsAt: "2026-10-07T23:59",
};

function errorsFor(values: Record<string, unknown>, options: Parameters<typeof checkPost>[1] = { now }) {
  const result = checkPost(values, options);
  return result.ok ? {} : result.errors;
}

describe("checkPost", () => {
  it("turns the form into the row's columns, starting now", () => {
    expect(checkPost(valid, { now })).toEqual({
      ok: true,
      post: {
        title: "No youth tonight",
        body: "We're taking the night off.",
        link_url: null,
        link_label: null,
        tone: "cancellation",
        pinned: true,
        starts_at: now.toISOString(),
        ends_at: "2026-10-08T06:59:00.000Z",
      },
    });
  });

  it("trims the title and body but keeps the body's line breaks", () => {
    const input = { ...valid, title: "  No youth tonight ", body: "\r\nLine one.\r\n\r\nLine two.  " };
    const result = checkPost(input, { now });

    expect(result.ok && result.post.title).toBe("No youth tonight");
    expect(result.ok && result.post.body).toBe("Line one.\n\nLine two.");
  });

  it("needs a title", () => {
    expect(errorsFor({ ...valid, title: "   " }).title).toBe("Give it a title.");
  });

  it("keeps the title to 80 characters and the body to 280", () => {
    expect(errorsFor({ ...valid, title: "a".repeat(80) }).title).toBeUndefined();
    expect(errorsFor({ ...valid, title: "a".repeat(81) }).title).toBe("Keep the title to 80 characters or fewer.");
    expect(errorsFor({ ...valid, body: "a".repeat(280) }).body).toBeUndefined();
    expect(errorsFor({ ...valid, body: "a".repeat(281) }).body).toBe("Keep it to 280 characters or fewer.");
  });

  it("lets the body be blank", () => {
    const result = checkPost({ ...valid, body: "  " }, { now });

    expect(result.ok && result.post.body).toBe("");
  });

  it("only takes the two tones", () => {
    expect(errorsFor({ ...valid, tone: "info" }).tone).toBeUndefined();
    expect(errorsFor({ ...valid, tone: "urgent" }).tone).toBe("Pick what kind of heads-up this is.");
  });

  describe("link", () => {
    const link = (linkUrl: string) => checkPost({ ...valid, linkUrl }, { now });

    it("takes an https link or a page on the site", () => {
      const external = link(" https://example.com/merch ");
      const page = link("/events/fall-retreat");

      expect(external.ok && external.post.link_url).toBe("https://example.com/merch");
      expect(page.ok && page.post.link_url).toBe("/events/fall-retreat");
    });

    it("adds https:// to a bare address", () => {
      const result = link("example.com/merch");

      expect(result.ok && result.post.link_url).toBe("https://example.com/merch");
    });

    it("refuses links that aren't https or a page on the site", () => {
      const message = "Use a link that starts with https://, or a page on the site like /this-week.";
      // Browsers read /\host as //host, another site.
      const bad = ["http://example.com", "//example.com", "/\\example.com", "javascript:alert(1)", "https://"];
      for (const linkUrl of bad) {
        expect(errorsFor({ ...valid, linkUrl }).linkUrl, linkUrl).toBe(message);
      }
    });

    it("refuses a link with a space in it", () => {
      for (const linkUrl of ["/this week", "https://example.com/a b"]) {
        expect(errorsFor({ ...valid, linkUrl }).linkUrl, linkUrl).toBe("Take the spaces out of the link.");
      }
    });

    it("keeps a link to 500 characters", () => {
      expect(errorsFor({ ...valid, linkUrl: `https://example.com/${"a".repeat(481)}` }).linkUrl).toBe(
        "Keep the link to 500 characters or fewer.",
      );
    });

    it("leaves the button text to the site when it's blank", () => {
      const result = checkPost({ ...valid, linkUrl: "/this-week", linkLabel: "  " }, { now });

      expect(result.ok && result.post.link_label).toBeNull();
    });

    it("keeps the button text to 24 characters", () => {
      const label = (linkLabel: string) => errorsFor({ ...valid, linkUrl: "/this-week", linkLabel }).linkLabel;

      expect(label("a".repeat(24))).toBeUndefined();
      expect(label("a".repeat(25))).toBe("Keep the button text to 24 characters or fewer.");
    });

    it("needs a link for button text", () => {
      expect(errorsFor({ ...valid, linkLabel: "Get yours" }).linkLabel).toBe(
        "Add a link for the button, or clear its text.",
      );
    });
  });

  describe("when", () => {
    it("starts at the time picked, read on the Los Angeles clock", () => {
      const result = checkPost({ ...valid, startsAt: "2026-10-09T09:00", endsAt: "2026-10-09T23:59" }, { now });

      expect(result.ok && result.post.starts_at).toBe("2026-10-09T16:00:00.000Z");
    });

    it("keeps a live heads-up's start when no new one is picked", () => {
      const started = laInstant("2026-10-05", "08:00");
      const result = checkPost(valid, { now, keepStart: started });

      expect(result.ok && result.post.starts_at).toBe(started.toISOString());
    });

    it("needs a real start date and time when one is picked", () => {
      expect(errorsFor({ ...valid, startsAt: "2026-02-30T09:00" }).startsAt).toBe("Pick a start date and time.");
    });

    it("needs an end", () => {
      expect(errorsFor({ ...valid, endsAt: "" }).endsAt).toBe("Pick when it comes down.");
    });

    it("needs the end after the start", () => {
      const values = { ...valid, startsAt: "2026-10-09T09:00", endsAt: "2026-10-09T09:00" };

      expect(errorsFor(values).endsAt).toBe("Pick an end after the start.");
    });

    it("refuses an end that's already passed", () => {
      expect(errorsFor({ ...valid, endsAt: "2026-10-07T14:59" }).endsAt).toBe(
        "That time has already passed. Pick a later one.",
      );
    });
  });

  it("reports every problem at once", () => {
    expect(Object.keys(errorsFor({ ...valid, title: "", tone: "", linkUrl: "ftp://x", endsAt: "" })).sort()).toEqual([
      "endsAt",
      "linkUrl",
      "title",
      "tone",
    ]);
  });

  it("checks the button and the end even when another field has a problem", () => {
    const values = { ...valid, title: "", linkLabel: "Go", startsAt: "2026-10-09T09:00", endsAt: "2026-10-08T09:00" };

    expect(errorsFor(values)).toEqual({
      title: "Give it a title.",
      linkLabel: "Add a link for the button, or clear its text.",
      endsAt: "Pick an end after the start.",
    });
  });

  it("treats a missing or odd form as blank fields", () => {
    expect(Object.keys(errorsFor({})).sort()).toEqual(["endsAt", "title", "tone"]);
    expect(Object.keys(errorsFor(null as unknown as Record<string, unknown>)).sort()).toEqual([
      "endsAt",
      "title",
      "tone",
    ]);
  });
});

describe("toLocalInput and fromLocalInput", () => {
  it("writes an instant as the Los Angeles clock for a date and time picker", () => {
    expect(toLocalInput("2026-10-08T06:59:00.000Z")).toBe("2026-10-07T23:59");
    expect(toLocalInput(new Date("2026-12-01T17:30:00Z"))).toBe("2026-12-01T09:30");
  });

  it("reads a picker's value back as the same instant", () => {
    expect(fromLocalInput("2026-10-07T23:59")?.toISOString()).toBe("2026-10-08T06:59:00.000Z");
    expect(fromLocalInput("2026-12-01T09:30")?.toISOString()).toBe("2026-12-01T17:30:00.000Z");
  });

  it("takes the seconds some pickers add, and nothing that isn't a date and time", () => {
    expect(fromLocalInput("2026-10-07T23:59:00")?.toISOString()).toBe("2026-10-08T06:59:00.000Z");
    for (const bad of ["", "2026-10-07", "2026-13-01T10:00", "2026-10-07T24:00", "soon"]) {
      expect(fromLocalInput(bad), bad).toBeNull();
    }
  });
});
