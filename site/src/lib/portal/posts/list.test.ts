import { describe, expect, it } from "vitest";
import { laInstant } from "@/lib/dates";
import { groupPosts, postState, whenLabel, windowSummary, type PostRow } from "./list";

// Wednesday, October 7, 2026 at 3 PM in Los Angeles.
const now = laInstant("2026-10-07", "15:00");
const at = (date: string, time: string) => laInstant(date, time).toISOString();

function post(id: string, extra: Partial<PostRow> = {}): PostRow {
  return {
    id,
    title: `Heads-up ${id}`,
    body: "",
    tone: "info",
    pinned: false,
    status: "published",
    link_url: null,
    link_label: null,
    starts_at: at("2026-10-05", "09:00"),
    ends_at: at("2026-10-11", "23:59"),
    updated_at: at("2026-10-05", "09:00"),
    ...extra,
  };
}

describe("postState", () => {
  it("calls a published heads-up live while now is in its window", () => {
    expect(postState(post("a"), now)).toBe("live");
  });

  it("calls one that starts later scheduled", () => {
    expect(postState(post("a", { starts_at: at("2026-10-08", "09:00") }), now)).toBe("scheduled");
  });

  it("calls one that has come down past, the moment it ends", () => {
    expect(postState(post("a", { ends_at: now.toISOString() }), now)).toBe("past");
  });

  it("calls an unpublished one a draft, whatever its times", () => {
    expect(postState(post("a", { status: "draft", ends_at: at("2026-10-01", "09:00") }), now)).toBe("draft");
  });
});

describe("groupPosts", () => {
  it("orders live heads-ups the way the site does: pinned first, then newest", () => {
    const posts = [
      post("old"),
      post("new", { starts_at: at("2026-10-06", "09:00") }),
      post("pinned-old", { pinned: true, starts_at: at("2026-10-01", "09:00") }),
      post("pinned-new", { pinned: true, starts_at: at("2026-10-04", "09:00") }),
    ];

    expect(groupPosts(posts, now).live.map((item) => item.id)).toEqual(["pinned-new", "pinned-old", "new", "old"]);
  });

  it("orders scheduled ones soonest first, drafts by last edit, and past ones by most recently ended", () => {
    const groups = groupPosts(
      [
        post("later", { starts_at: at("2026-10-09", "09:00") }),
        post("sooner", { starts_at: at("2026-10-08", "09:00") }),
        post("draft-old", { status: "draft", updated_at: at("2026-10-01", "09:00") }),
        post("draft-new", { status: "draft", updated_at: at("2026-10-06", "09:00") }),
        post("ended-long-ago", { starts_at: at("2026-09-01", "09:00"), ends_at: at("2026-09-02", "09:00") }),
        post("ended-lately", { starts_at: at("2026-10-01", "09:00"), ends_at: at("2026-10-06", "09:00") }),
      ],
      now,
    );

    expect(groups.scheduled.map((item) => item.id)).toEqual(["sooner", "later"]);
    expect(groups.draft.map((item) => item.id)).toEqual(["draft-new", "draft-old"]);
    expect(groups.past.map((item) => item.id)).toEqual(["ended-lately", "ended-long-ago"]);
    expect(groups.live).toEqual([]);
  });
});

describe("whenLabel", () => {
  it("says when a live heads-up comes down", () => {
    expect(whenLabel(post("a", { ends_at: at("2026-10-07", "23:59") }), now)).toBe("Up until today at 11:59 PM");
    expect(whenLabel(post("a", { ends_at: at("2026-10-08", "21:00") }), now)).toBe("Up until tomorrow at 9:00 PM");
    expect(whenLabel(post("a"), now)).toBe("Up until Sun, Oct 11 at 11:59 PM");
  });

  it("says when a scheduled one goes up", () => {
    expect(whenLabel(post("a", { starts_at: at("2026-10-09", "09:00") }), now)).toBe("Goes up Fri, Oct 9 at 9:00 AM");
  });

  it("says when a past one came down, with the year once it's another year", () => {
    const ended = { starts_at: at("2025-12-01", "09:00"), ends_at: at("2025-12-31", "23:59") };

    expect(whenLabel(post("a", { ends_at: at("2026-10-06", "21:00") }), now)).toBe(
      "Came down yesterday at 9:00 PM",
    );
    expect(whenLabel(post("a", ended), now)).toBe("Came down Wed, Dec 31, 2025 at 11:59 PM");
  });

  it("calls a draft not published", () => {
    expect(whenLabel(post("a", { status: "draft" }), now)).toBe("Not published");
  });
});

describe("windowSummary", () => {
  it("describes a heads-up that goes up when it's published", () => {
    expect(windowSummary(null, laInstant("2026-10-11", "23:59"), now)).toBe(
      "Goes up when you publish and comes down Sun, Oct 11 at 11:59 PM.",
    );
  });

  it("describes a scheduled one", () => {
    expect(windowSummary(laInstant("2026-10-08", "09:00"), laInstant("2026-10-08", "23:59"), now)).toBe(
      "Goes up tomorrow at 9:00 AM and comes down tomorrow at 11:59 PM.",
    );
  });

  it("describes one that's already up", () => {
    expect(windowSummary(laInstant("2026-10-05", "09:00"), laInstant("2026-10-07", "23:59"), now)).toBe(
      "Up since Mon, Oct 5 at 9:00 AM. Comes down today at 11:59 PM.",
    );
  });

  it("leaves the end out until one is picked", () => {
    expect(windowSummary(null, null, now)).toBe("Goes up when you publish.");
  });
});
