import { describe, expect, it } from "vitest";
import { placementBadge, placementLabel, placementNote, type PlacedEvent } from "./placement";
import { LIBRARY } from "./schema";

const RETREAT = "00000000-0000-4000-8000-5eed0000e003";
const GAME_NIGHT = "00000000-0000-4000-8000-5eed0000e007";

const events = new Map<string, PlacedEvent>([
  [RETREAT, { id: RETREAT, title: "Weekend Retreat", status: "published" }],
  [GAME_NIGHT, { id: GAME_NIGHT, title: "Game Night", status: "draft" }],
]);

const hero = { id: "hero", spot: "home-hero", eventId: null };
const cover = { id: "cover", spot: null, eventId: RETREAT };
const loose = { id: "loose", spot: null, eventId: null };
const photos = [hero, cover, loose];

describe("placementBadge", () => {
  it("names a spot shortly, and an event's cover by its title", () => {
    expect(placementBadge(hero, events)).toBe("Home");
    expect(placementBadge(cover, events)).toBe("Cover: Weekend Retreat");
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
