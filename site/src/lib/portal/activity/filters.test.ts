import { describe, expect, it } from "vitest";
import {
  activityHref,
  activityQuery,
  DEFAULT_ACTIVITY_FILTERS,
  firstSince,
  kindsFor,
  olderSince,
  parseActivityFilters,
  scopesFor,
  withScope,
} from "./filters";

const PERSON = "00000000-0000-4000-8000-0000000000a1";
const TODAY = "2026-10-05";

describe("scopesFor", () => {
  it("gives site roles the site, finance viewers finances, and owners everything", () => {
    expect(scopesFor(["site_editor"])).toEqual(["site"]);
    expect(scopesFor(["site_messages"])).toEqual(["site"]);
    expect(scopesFor(["finance_viewer"])).toEqual(["finances"]);
    expect(scopesFor(["finance_viewer", "site_editor"])).toEqual(["site", "finances"]);
    expect(scopesFor(["owner"])).toEqual(["site", "finances", "platform"]);
  });

  it("shows requesters nothing, even their own requests' history", () => {
    expect(scopesFor(["finance_requester"])).toEqual([]);
    expect(scopesFor(["finance_requester", "site_editor"])).toEqual(["site"]);
  });
});

describe("kindsFor", () => {
  it("offers only the actions in the apps someone can see", () => {
    expect(kindsFor(["finances"], "all")).toEqual(["requests", "status", "payments", "receipts", "income", "downloads"]);
    expect(kindsFor(["site"], "all")).toEqual(["posts", "events"]);
  });

  it("narrows to the app picked", () => {
    const owner = scopesFor(["owner"]);
    expect(kindsFor(owner, "all")).toEqual([
      "posts",
      "events",
      "requests",
      "status",
      "payments",
      "receipts",
      "income",
      "access",
      "invites",
      "sign_ins",
      "downloads",
      "backups",
    ]);
    expect(kindsFor(owner, "platform")).toEqual(["access", "invites", "sign_ins", "downloads", "backups"]);
    expect(kindsFor(owner, "site")).toEqual(["posts", "events"]);
  });
});

describe("parseActivityFilters", () => {
  const owner = scopesFor(["owner"]);

  it("starts with everything from the past week", () => {
    expect(parseActivityFilters({}, owner, TODAY)).toEqual(DEFAULT_ACTIVITY_FILTERS);
    expect(DEFAULT_ACTIVITY_FILTERS).toEqual({ scope: "all", person: null, kind: "all", since: null });
  });

  it("reads the app, person, action, and how far back from the URL", () => {
    const params = { app: "finances", person: PERSON, action: "payments", since: "2026-08-22" };
    const filters = { scope: "finances", person: PERSON, kind: "payments", since: "2026-08-22" };
    expect(parseActivityFilters(params, owner, TODAY)).toEqual(filters);
  });

  it("ignores an app the person can't see, so a site editor gets no finance filter", () => {
    expect(parseActivityFilters({ app: "finances" }, ["site"], TODAY).scope).toBe("all");
    expect(parseActivityFilters({ app: "platform" }, ["site", "finances"], TODAY).scope).toBe("all");
    expect(parseActivityFilters({ app: "nope" }, owner, TODAY).scope).toBe("all");
  });

  it("ignores an action outside the apps shown", () => {
    expect(parseActivityFilters({ action: "payments" }, ["site"], TODAY).kind).toBe("all");
    expect(parseActivityFilters({ app: "platform", action: "payments" }, owner, TODAY).kind).toBe("all");
    expect(parseActivityFilters({ action: "everything" }, owner, TODAY).kind).toBe("all");
  });

  it("takes only a real ID for the person", () => {
    expect(parseActivityFilters({ person: "alex" }, owner, TODAY).person).toBeNull();
    expect(parseActivityFilters({ person: [PERSON, "x"] }, owner, TODAY).person).toBe(PERSON);
  });

  it("takes only a real date before the past week for how far back", () => {
    expect(parseActivityFilters({ since: "last week" }, owner, TODAY).since).toBeNull();
    expect(parseActivityFilters({ since: "2026-02-30" }, owner, TODAY).since).toBeNull();
    expect(parseActivityFilters({ since: "2026-09-29" }, owner, TODAY).since).toBeNull();
    expect(parseActivityFilters({ since: "2026-11-01" }, owner, TODAY).since).toBeNull();
    expect(parseActivityFilters({ since: "2026-09-28" }, owner, TODAY).since).toBe("2026-09-28");
  });
});

describe("activityHref", () => {
  it("leaves out the defaults", () => {
    expect(activityHref(DEFAULT_ACTIVITY_FILTERS)).toBe("/activity");
    expect(activityHref({ scope: "finances", person: PERSON, kind: "payments", since: "2026-09-22" })).toBe(
      `/activity?app=finances&person=${PERSON}&action=payments&since=2026-09-22`,
    );
  });

  it("can point at the download instead, which has every date", () => {
    expect(
      activityHref({ ...DEFAULT_ACTIVITY_FILTERS, kind: "sign_ins", since: "2026-08-22" }, "/activity/export"),
    ).toBe("/activity/export?action=sign_ins");
  });
});

describe("withScope", () => {
  it("keeps the action when it's in the new app, and starts over at the past week", () => {
    const filters = { scope: "all", person: PERSON, kind: "downloads", since: "2026-08-22" } as const;
    expect(withScope(filters, "platform")).toEqual({
      scope: "platform",
      person: PERSON,
      kind: "downloads",
      since: null,
    });
  });

  it("drops an action the new app doesn't have", () => {
    const filters = { scope: "all", person: null, kind: "payments", since: null } as const;
    expect(withScope(filters, "platform").kind).toBe("all");
  });
});

describe("firstSince", () => {
  it("shows the past week, today included", () => {
    expect(firstSince(TODAY)).toBe("2026-09-29");
  });
});

describe("olderSince", () => {
  it("reaches back another week, then a month at a time", () => {
    expect(olderSince("2026-09-29", "2026-09-28", TODAY)).toBe("2026-09-22");
    expect(olderSince("2026-09-22", "2026-09-21", TODAY)).toBe("2026-08-22");
    expect(olderSince("2026-08-22", "2026-08-21", TODAY)).toBe("2026-07-22");
  });

  it("covers the newest activity it's reaching for", () => {
    expect(olderSince("2026-09-29", "2026-09-22", TODAY)).toBe("2026-09-22");
    expect(olderSince("2026-09-22", "2026-08-22", TODAY)).toBe("2026-08-22");
  });

  it("skips a stretch with nothing in it, to the stretch that ends with the next activity", () => {
    expect(olderSince("2026-09-29", "2026-09-20", TODAY)).toBe("2026-08-21");
    expect(olderSince("2026-09-29", "2026-06-10", TODAY)).toBe("2026-05-11");
    expect(olderSince("2026-08-22", "2025-12-31", TODAY)).toBe("2025-12-01");
  });
});

describe("activityQuery", () => {
  it("reads only the apps someone can see", () => {
    expect(activityQuery(DEFAULT_ACTIVITY_FILTERS, ["site", "finances"])).toEqual({
      scopes: ["site", "finances"],
      actions: null,
      actorId: null,
    });
  });

  it("narrows to the app, the actions in a kind, and the person", () => {
    const filters = { scope: "finances", person: PERSON, kind: "payments", since: null } as const;
    expect(activityQuery(filters, scopesFor(["owner"]))).toEqual({
      scopes: ["finances"],
      actions: ["request.paid", "request.recorded_paid", "request.unpaid"],
      actorId: PERSON,
    });
  });

  it("counts corrections and tag changes as request edits", () => {
    const filters = { ...DEFAULT_ACTIVITY_FILTERS, kind: "requests" } as const;
    expect(activityQuery(filters, scopesFor(["owner"])).actions).toEqual([
      "request.created",
      "request.updated",
      "request.corrected",
      "request.tagged",
      "tag.created",
      "tag.updated",
      "tag.deleted",
    ]);
  });

  it("finds every tithe, event income, and cafe week change under Income", () => {
    const filters = { ...DEFAULT_ACTIVITY_FILTERS, kind: "income" } as const;
    expect(activityQuery(filters, scopesFor(["finance_viewer"])).actions).toEqual([
      "youth_income.created",
      "youth_income.updated",
      "youth_income.deleted",
      "youth_income.imported",
      "cafe_week.created",
      "cafe_week.updated",
      "cafe_week.deleted",
    ]);
  });

  it("finds downloads in both apps that have them", () => {
    const filters = { ...DEFAULT_ACTIVITY_FILTERS, kind: "downloads" } as const;
    expect(activityQuery(filters, scopesFor(["owner"])).actions).toEqual(["export.downloaded", "activity.exported"]);
  });
});
