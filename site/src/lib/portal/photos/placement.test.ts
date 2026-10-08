import { describe, expect, it } from "vitest";
import { PHOTO_SPOTS } from "@/lib/photo-spots";
import {
  emptySpots,
  placementBadge,
  placementLabel,
  placementNote,
  postPhotoChoices,
  postPhotoOptions,
  type PlacedEvent,
} from "./placement";
import { LIBRARY } from "./schema";

const RETREAT = "00000000-0000-4000-8000-5eed0000e003";
const GAME_NIGHT = "00000000-0000-4000-8000-5eed0000e007";

const events = new Map<string, PlacedEvent>([
  [RETREAT, { id: RETREAT, title: "Weekend Retreat", status: "published" }],
  [GAME_NIGHT, { id: GAME_NIGHT, title: "Game Night", status: "draft" }],
]);

const MERCH = "00000000-0000-4000-8000-5eed0000c001";

const hero = { id: "hero", spot: "home-hero", eventId: null, postId: null, post: null };
const cover = { id: "cover", spot: null, eventId: RETREAT, postId: null, post: null };
const loose = { id: "loose", spot: null, eventId: null, postId: null, post: null };
const merch = {
  id: "merch",
  spot: null,
  eventId: null,
  postId: MERCH,
  post: { title: "Hoodies are in", status: "published", endsAt: "2026-10-11T06:59:00Z" },
} as const;
const photos = [hero, cover, loose, merch];

describe("placementBadge", () => {
  it("names a spot shortly, and an event's cover by its title", () => {
    expect(placementBadge(hero, events)).toBe("Home");
    expect(placementBadge(cover, events)).toBe("Cover: Weekend Retreat");
  });

  it("names a heads-up by its title", () => {
    expect(placementBadge(merch, events)).toBe("Heads-up: Hoodies are in");
  });

  it("gives nothing for a photo only in the library", () => {
    expect(placementBadge(loose, events)).toBeNull();
  });

  it("still marks a photo whose spot or event the site dropped", () => {
    expect(placementBadge({ ...loose, spot: "old-banner" }, events)).toBe("Old spot");
    expect(placementBadge({ ...loose, eventId: "gone" }, events)).toBe("Cover");
  });
});

describe("placementLabel", () => {
  it("names the place in full", () => {
    expect(placementLabel(LIBRARY, events)).toBe("Not on the site");
    expect(placementLabel("spot:youth-cafe", events)).toBe("This Week: The Youth Cafe");
    expect(placementLabel(`event:${RETREAT}`, events)).toBe("Cover of Weekend Retreat");
  });

  it("names the heads-up a photo is on", () => {
    expect(placementLabel(`post:${MERCH}`, events, merch)).toBe("Heads-up: Hoodies are in");
    expect(placementLabel(`post:${MERCH}`, events, loose)).toBe("A heads-up");
  });
});

describe("placementNote", () => {
  it("says the library keeps it off the site", () => {
    expect(placementNote(LIBRARY, hero, photos, events)).toBe("Nothing on the site shows it.");
  });

  it("says the photo in a spot goes back to the library", () => {
    expect(placementNote("spot:home-hero", loose, photos, events)).toBe(
      "The photo there now goes back to the library.",
    );
    expect(placementNote(`event:${RETREAT}`, loose, photos, events)).toBe(
      "The event's cover now goes back to the library.",
    );
  });

  it("says nothing changes for a photo already there", () => {
    expect(placementNote("spot:home-hero", hero, photos, events)).toBe("It's there now.");
    expect(placementNote(`post:${MERCH}`, merch, photos, events)).toBe("It shows with the heads-up while it's up.");
  });

  it("says where a new place shows it", () => {
    expect(placementNote("spot:youth-cafe", loose, photos, events)).toBe("It shows there next time the page loads.");
  });

  it("says a draft's cover waits for the event to go up", () => {
    expect(placementNote(`event:${GAME_NIGHT}`, loose, photos, events)).toBe(
      "It shows once the event is published.",
    );
  });
});

describe("postPhotoChoices", () => {
  const now = new Date("2026-10-08T20:00:00Z");
  const over = { ...merch, id: "over", postId: "old", post: { ...merch.post, endsAt: "2026-10-01T06:59:00Z" } };
  const draft = { ...merch, id: "draft", postId: "draft", post: { ...merch.post, status: "draft" } } as const;

  it("offers photos only in the library and ones on heads-ups that came down", () => {
    const choices = postPhotoChoices([hero, cover, loose, merch, over, draft], null, now);
    expect(choices.map(({ id }) => id)).toEqual(["loose", "over"]);
  });

  it("leaves out the heads-up's own photo, which shows on its own", () => {
    expect(postPhotoChoices([loose, merch], MERCH, now).map(({ id }) => id)).toEqual(["loose"]);
  });
});

describe("postPhotoOptions", () => {
  const now = new Date("2026-10-08T20:00:00Z");
  const over = { ...merch, id: "over", postId: "old", post: { ...merch.post, endsAt: "2026-10-01T06:59:00Z" } };
  const draft = { ...merch, id: "draft", postId: "draft", post: { ...merch.post, status: "draft" } } as const;

  it("starts a heads-up with its own photo, and keeps it among the choices to pick again", () => {
    const { photo, choices } = postPhotoOptions([hero, loose, merch], MERCH, null, now);
    expect(photo?.id).toBe("merch");
    expect(choices.map(({ id }) => id)).toEqual(["merch", "loose"]);
  });

  it("starts a heads-up without a photo when it has none", () => {
    const { photo, choices } = postPhotoOptions([hero, loose, over], MERCH, null, now);
    expect(photo).toBeNull();
    expect(choices.map(({ id }) => id)).toEqual(["loose", "over"]);
  });

  it("starts a new one with nothing", () => {
    expect(postPhotoOptions([loose, merch], null, null, now).photo).toBeNull();
  });

  it("gives one posted again the photo of the heads-up it came from, once that one's down", () => {
    const { photo, choices } = postPhotoOptions([loose, over], null, "old", now);
    expect(photo?.id).toBe("over");
    expect(choices.map(({ id }) => id)).toEqual(["loose", "over"]);
  });

  it("leaves a photo that can't move where it is", () => {
    expect(postPhotoOptions([loose, draft], null, "draft", now).photo).toBeNull();
    expect(postPhotoOptions([loose, merch], null, MERCH, now).photo).toBeNull();
  });
});

describe("emptySpots", () => {
  it("lists the spots without a photo by page, leaving out filled ones", () => {
    const pages = emptySpots(photos);
    expect(pages[0]).toEqual(["This Week", ["Bring a friend, also on Home", "The Youth Cafe"]]);
    expect(pages.flatMap(([, labels]) => labels)).not.toContain("Top of the page");
    expect(pages.flatMap(([, labels]) => labels)).toHaveLength(PHOTO_SPOTS.length - 1);
  });

  it("drops a page once every spot on it has a photo", () => {
    const give = ["give-food", "give-birthdays", "give-volleyball", "give-band"].map((spot) => ({
      id: spot,
      spot,
      eventId: null,
      postId: null,
      post: null,
    }));
    const pages = emptySpots([hero, ...give]).map(([page]) => page);
    expect(pages).toEqual(["This Week", "Plan a Visit", "Parents & Safety"]);
  });

  it("lists every spot when nothing is placed", () => {
    expect(emptySpots([cover, loose]).flatMap(([, labels]) => labels)).toHaveLength(PHOTO_SPOTS.length);
    expect(emptySpots([])[0][0]).toBe("Home");
  });
});
