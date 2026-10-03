import { describe, expect, it } from "vitest";
import type { Photo, SiteEvent } from "@/lib/content/types";
import type { EventValues } from "@/lib/portal/events/schema";
import type { PostValues } from "@/lib/portal/posts/schema";
import { previewEvent, previewPost, readPreviewRequest } from "./preview";

const post: PostValues = {
  title: "Hoodies are in",
  body: "Grab one after service.",
  linkUrl: "",
  linkLabel: "",
  tone: "info",
  pinned: false,
  startsAt: "",
  endsAt: "2026-10-09T23:59",
};

const photo: Photo = { src: "https://images.example.com/retreat.jpg", alt: "Cabins by a lake", placeholder: true };

const retreat = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "fall-retreat",
  title: "Fall Retreat",
  photo,
} as SiteEvent;

describe("previewPost", () => {
  it("shows the heads-up the way the site will", () => {
    const result = previewPost({ ...post, linkUrl: "/merch", pinned: true }, []);
    expect(result).toMatchObject({
      ok: true,
      post: {
        title: "Hoodies are in",
        body: "Grab one after service.",
        pinned: true,
        cta: { label: "Learn more", href: "/merch" },
      },
    });
  });

  it("tags a change of plans", () => {
    const result = previewPost({ ...post, tone: "cancellation" }, []);
    expect(result.ok && result.post.changeOfPlans).toBe(true);
  });

  it("borrows the photo of the event it links to, like the site", () => {
    const result = previewPost({ ...post, linkUrl: "/events/fall-retreat" }, [retreat]);
    expect(result.ok && result.post.photo).toEqual(photo);
  });

  it("finishes a link typed without https://, like saving does", () => {
    const result = previewPost({ ...post, linkUrl: "example.com/merch", linkLabel: "Shop" }, []);
    expect(result.ok && result.post.cta).toEqual({ label: "Shop", href: "https://example.com/merch" });
  });

  it("stands in a title until there is one", () => {
    const result = previewPost({ ...post, title: "  " }, []);
    expect(result.ok && result.post.title).toBe("Untitled heads-up");
  });

  it("doesn't care when it's up, since the cards don't show it", () => {
    expect(previewPost({ ...post, startsAt: "2020-01-01T09:00", endsAt: "2020-01-01T08:00" }, []).ok).toBe(true);
    expect(previewPost({ ...post, endsAt: "" }, []).ok).toBe(true);
  });

  it("says what to fix when the site couldn't show it", () => {
    expect(previewPost({ ...post, linkUrl: "javascript:alert(1)" }, [])).toEqual({
      ok: false,
      problem: "Use a link that starts with https://, or a page on the site like /this-week.",
    });
  });
});

const event: EventValues = {
  title: "Fall Retreat",
  summary: "Three days away.",
  body: "Bring a sleeping bag.\n\nWe leave from the church.",
  allDay: false,
  startDate: "2026-10-16",
  startTime: "17:00",
  endDate: "2026-10-18",
  endTime: "12:00",
  locationName: "Camp Example",
  address: "1 Camp Road, Example, WA",
  costNote: "$40",
  featured: true,
};

describe("previewEvent", () => {
  it("shows the event the way the site will", () => {
    const result = previewEvent(event, { id: null, slug: null });
    expect(result).toMatchObject({
      ok: true,
      event: {
        slug: "fall-retreat",
        title: "Fall Retreat",
        summary: "Three days away.",
        description: "Bring a sleeping bag.\n\nWe leave from the church.",
        startsAt: "2026-10-17T00:00:00.000Z",
        endsAt: "2026-10-18T19:00:00.000Z",
        allDay: false,
        locationName: "Camp Example",
        locationAddress: "1 Camp Road, Example, WA",
        costNote: "$40",
        featured: true,
      },
    });
    expect(result.ok && result.event.cancelled).toBeUndefined();
  });

  it("keeps a published event's page where it is", () => {
    const result = previewEvent({ ...event, title: "Fall Retreat 2026" }, { id: retreat.id, slug: "fall-retreat" });
    expect(result.ok && result.event.slug).toBe("fall-retreat");
    expect(result.ok && result.event.id).toBe(retreat.id);
  });

  it("shows the photo it's given", () => {
    const result = previewEvent(event, { id: retreat.id, slug: "fall-retreat", photo });
    expect(result.ok && result.event.photo).toEqual(photo);
  });

  it("leaves out blank details, like saving does", () => {
    const result = previewEvent({ ...event, summary: " ", costNote: "", address: "" }, { id: null, slug: null });
    expect(result.ok && result.event).not.toHaveProperty("summary");
    expect(result.ok && result.event).not.toHaveProperty("costNote");
    expect(result.ok && result.event).not.toHaveProperty("locationAddress");
  });

  it("stands in a title until there is one", () => {
    const result = previewEvent({ ...event, title: "" }, { id: null, slug: null });
    expect(result.ok && result.event.title).toBe("Untitled event");
    expect(result.ok && result.event.slug).toBe("untitled-event");
  });

  it("shows one that's already over, so a past event can be looked at too", () => {
    const result = previewEvent({ ...event, startDate: "2020-01-03", endDate: "2020-01-03", endTime: "21:00" }, {
      id: null,
      slug: null,
    });
    expect(result.ok).toBe(true);
  });

  it("says what's missing before it can show the event", () => {
    expect(previewEvent({ ...event, startDate: "" }, { id: null, slug: null })).toEqual({
      ok: false,
      problem: "Pick the day it starts.",
    });
    expect(previewEvent({ ...event, endTime: "16:00", endDate: "2026-10-16" }, { id: null, slug: null })).toEqual({
      ok: false,
      problem: "Pick an end after the start.",
    });
  });
});

describe("readPreviewRequest", () => {
  it("takes a heads-up's values", () => {
    expect(readPreviewRequest({ kind: "post", values: post })).toEqual({ kind: "post", values: post });
  });

  it("takes an event's values, id, and slug", () => {
    const request = { kind: "event", values: event, id: retreat.id, slug: "beach-day" };
    expect(readPreviewRequest(request)).toEqual(request);
    expect(readPreviewRequest({ kind: "event", values: event, id: null, slug: null })).toEqual({
      kind: "event",
      values: event,
      id: null,
      slug: null,
    });
  });

  it("drops anything extra", () => {
    const request = readPreviewRequest({ kind: "post", values: { ...post, status: "published" }, extra: 1 });
    expect(request).toEqual({ kind: "post", values: post });
  });

  it("refuses anything that isn't an editor's values", () => {
    expect(readPreviewRequest(null)).toBeNull();
    expect(readPreviewRequest("post")).toBeNull();
    expect(readPreviewRequest({ kind: "photo", values: post })).toBeNull();
    expect(readPreviewRequest({ kind: "post" })).toBeNull();
    expect(readPreviewRequest({ kind: "post", values: { ...post, title: 5 } })).toBeNull();
    expect(readPreviewRequest({ kind: "post", values: { ...post, pinned: "yes" } })).toBeNull();
    const missing = { ...event, endTime: undefined };
    expect(readPreviewRequest({ kind: "event", values: missing, id: null, slug: null })).toBeNull();
    expect(readPreviewRequest({ kind: "event", values: event, id: 7, slug: null })).toBeNull();
  });
});
