import { describe, expect, it } from "vitest";
import {
  ALT_MAX,
  checkAlt,
  checkNewPhoto,
  checkPhotoEdit,
  checkReason,
  checkRemoval,
  LIBRARY,
  parsePlacement,
  placementValue,
  REASON_MAX,
} from "./schema";

const PHOTO_ID = "0d3f6a8e-2b1c-4e5f-9a7b-1c2d3e4f5a6b";
const EVENT_ID = "00000000-0000-4000-8000-5eed0000e001";
const MESSAGE_ID = "00000000-0000-4000-8000-00000000d001";

describe("checkAlt", () => {
  it("trims the description", () => {
    expect(checkAlt("  Hands raised during worship \n")).toEqual({ ok: true, alt: "Hands raised during worship" });
  });

  it("needs a description", () => {
    expect(checkAlt("   ")).toEqual({ ok: false, error: "Describe what's in the photo." });
  });

  it("keeps it short", () => {
    expect(checkAlt("a".repeat(ALT_MAX)).ok).toBe(true);
    expect(checkAlt("a".repeat(ALT_MAX + 1))).toEqual({
      ok: false,
      error: `Keep it to ${ALT_MAX} characters or fewer.`,
    });
  });
});

describe("checkNewPhoto", () => {
  const photo = {
    id: "0d3f6a8e-2b1c-4e5f-9a7b-1c2d3e4f5a6b",
    alt: " A crowd under stage lights ",
    width: 1600,
    height: 900,
  };

  it("passes a new photo's row through, with its alt text trimmed", () => {
    expect(checkNewPhoto(photo)).toEqual({ ok: true, row: { ...photo, alt: "A crowd under stage lights" } });
  });

  it("says what's wrong with the alt text", () => {
    expect(checkNewPhoto({ ...photo, alt: "" })).toEqual({ ok: false, message: "Describe what's in the photo." });
  });

  it("refuses an id that isn't a random folder name", () => {
    for (const id of ["jo-at-the-retreat", "", "0D3F6A8E-2B1C-4E5F-9A7B-1C2D3E4F5A6B", 42]) {
      expect(checkNewPhoto({ ...photo, id } as never).ok).toBe(false);
    }
  });

  it("refuses sizes the database wouldn't take", () => {
    for (const size of [0, 4001, 1.5, Number.NaN, "1600"]) {
      expect(checkNewPhoto({ ...photo, width: size } as never).ok).toBe(false);
      expect(checkNewPhoto({ ...photo, height: size } as never).ok).toBe(false);
    }
  });

  it("refuses alt text that isn't text", () => {
    expect(checkNewPhoto({ ...photo, alt: null } as never)).toEqual({
      ok: false,
      message: "Describe what's in the photo.",
    });
  });
});

describe("placementValue and parsePlacement", () => {
  it("round-trips the library, a spot, and an event's cover", () => {
    for (const placement of [
      { spot: null, eventId: null },
      { spot: "home-hero", eventId: null },
      { spot: null, eventId: EVENT_ID },
    ] as const) {
      expect(parsePlacement(placementValue(placement))).toEqual(placement);
    }
  });

  it("names the library plainly", () => {
    expect(placementValue({ spot: null, eventId: null })).toBe(LIBRARY);
  });

  it("refuses spots the site doesn't have and ids that aren't ids", () => {
    for (const value of ["spot:home", "spot:", "event:retreat", `event:${EVENT_ID.toUpperCase()}`, "home-hero", 42]) {
      expect(parsePlacement(value)).toBeNull();
    }
  });
});

describe("checkPhotoEdit", () => {
  it("gives the row's new alt text and place", () => {
    expect(checkPhotoEdit({ id: PHOTO_ID, alt: " Friends at the retreat ", placement: `event:${EVENT_ID}` })).toEqual({
      ok: true,
      id: PHOTO_ID,
      changes: { alt: "Friends at the retreat", spot: null, event_id: EVENT_ID },
    });
  });

  it("clears both places for the library", () => {
    expect(checkPhotoEdit({ id: PHOTO_ID, alt: "A latte", placement: LIBRARY })).toEqual({
      ok: true,
      id: PHOTO_ID,
      changes: { alt: "A latte", spot: null, event_id: null },
    });
  });

  it("says what's wrong with the alt text", () => {
    expect(checkPhotoEdit({ id: PHOTO_ID, alt: " ", placement: LIBRARY })).toEqual({
      ok: false,
      message: "Describe what's in the photo.",
    });
  });

  it("refuses a place or photo that didn't come through right", () => {
    expect(checkPhotoEdit({ id: PHOTO_ID, alt: "A latte", placement: "spot:nowhere" }).ok).toBe(false);
    expect(checkPhotoEdit({ id: "photo", alt: "A latte", placement: LIBRARY }).ok).toBe(false);
  });
});

describe("checkReason", () => {
  it("trims the reason", () => {
    expect(checkReason("  A parent asked \n")).toEqual({ ok: true, reason: "A parent asked" });
  });

  it("needs a reason", () => {
    expect(checkReason(" ")).toEqual({ ok: false, error: "Say why it's coming down." });
    expect(checkReason(undefined)).toEqual({ ok: false, error: "Say why it's coming down." });
  });

  it("keeps it short", () => {
    expect(checkReason("a".repeat(REASON_MAX)).ok).toBe(true);
    expect(checkReason("a".repeat(REASON_MAX + 1))).toEqual({
      ok: false,
      error: `Keep it to ${REASON_MAX} characters or fewer.`,
    });
  });
});

describe("checkRemoval", () => {
  it("passes a takedown through, linked to a request or not", () => {
    expect(checkRemoval({ id: PHOTO_ID, reason: " Out of focus ", messageId: null })).toEqual({
      ok: true,
      removal: { id: PHOTO_ID, reason: "Out of focus", messageId: null },
    });
    expect(checkRemoval({ id: PHOTO_ID, reason: "A parent asked", messageId: MESSAGE_ID })).toEqual({
      ok: true,
      removal: { id: PHOTO_ID, reason: "A parent asked", messageId: MESSAGE_ID },
    });
  });

  it("says what's wrong with the reason", () => {
    expect(checkRemoval({ id: PHOTO_ID, reason: "", messageId: null })).toEqual({
      ok: false,
      message: "Say why it's coming down.",
    });
  });

  it("refuses a photo or request that isn't an id", () => {
    expect(checkRemoval({ id: "photo", reason: "A parent asked", messageId: null }).ok).toBe(false);
    expect(checkRemoval({ id: PHOTO_ID, reason: "A parent asked", messageId: "request" }).ok).toBe(false);
  });
});
