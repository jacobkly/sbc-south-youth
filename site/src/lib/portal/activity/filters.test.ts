import { describe, expect, it } from "vitest";
import {
  ACTIVITY_PAGE_SIZE,
  activityHref,
  activityQuery,
  DEFAULT_ACTIVITY_FILTERS,
  kindsFor,
  MAX_ACTIVITY_PAGES,
  parseActivityFilters,
  scopesFor,
  withScope,
} from "./filters";

const PERSON = "00000000-0000-4000-8000-0000000000a1";

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
    expect(kindsFor(["finances"], "all")).toEqual(["requests", "status", "payments", "receipts", "downloads"]);
    expect(kindsFor(["site"], "all")).toEqual([]);
  });

  it("narrows to the app picked", () => {
    const owner = scopesFor(["owner"]);
    expect(kindsFor(owner, "all")).toEqual([
      "requests",
      "status",
      "payments",
      "receipts",
      "access",
      "invites",
      "sign_ins",
      "downloads",
    ]);
    expect(kindsFor(owner, "platform")).toEqual(["access", "invites", "sign_ins", "downloads"]);
    expect(kindsFor(owner, "site")).toEqual([]);
  });
});

describe("parseActivityFilters", () => {
  const owner = scopesFor(["owner"]);

  it("starts with everything, newest page first", () => {
    expect(parseActivityFilters({}, owner)).toEqual(DEFAULT_ACTIVITY_FILTERS);
    expect(DEFAULT_ACTIVITY_FILTERS).toEqual({ scope: "all", person: null, kind: "all", pages: 1 });
  });

  it("reads the app, person, action, and pages from the URL", () => {
    const params = { app: "finances", person: PERSON, action: "payments", pages: "3" };
    const filters = { scope: "finances", person: PERSON, kind: "payments", pages: 3 };
    expect(parseActivityFilters(params, owner)).toEqual(filters);
  });

  it("ignores an app the person can't see, so a site editor gets no finance filter", () => {
    expect(parseActivityFilters({ app: "finances" }, ["site"]).scope).toBe("all");
    expect(parseActivityFilters({ app: "platform" }, ["site", "finances"]).scope).toBe("all");
    expect(parseActivityFilters({ app: "nope" }, owner).scope).toBe("all");
  });

  it("ignores an action outside the apps shown", () => {
    expect(parseActivityFilters({ action: "payments" }, ["site"]).kind).toBe("all");
    expect(parseActivityFilters({ app: "platform", action: "payments" }, owner).kind).toBe("all");
    expect(parseActivityFilters({ action: "everything" }, owner).kind).toBe("all");
  });

  it("takes only a real ID for the person", () => {
    expect(parseActivityFilters({ person: "alex" }, owner).person).toBeNull();
    expect(parseActivityFilters({ person: [PERSON, "x"] }, owner).person).toBe(PERSON);
  });

  it("keeps pages between 1 and the most there can be", () => {
    expect(parseActivityFilters({ pages: "0" }, owner).pages).toBe(1);
    expect(parseActivityFilters({ pages: "2.5" }, owner).pages).toBe(1);
    expect(parseActivityFilters({ pages: "999" }, owner).pages).toBe(MAX_ACTIVITY_PAGES);
    expect(MAX_ACTIVITY_PAGES * ACTIVITY_PAGE_SIZE).toBe(1000);
  });
});

describe("activityHref", () => {
  it("leaves out the defaults", () => {
    expect(activityHref(DEFAULT_ACTIVITY_FILTERS)).toBe("/activity");
    expect(activityHref({ scope: "finances", person: PERSON, kind: "payments", pages: 2 })).toBe(
      `/activity?app=finances&person=${PERSON}&action=payments&pages=2`,
    );
  });

  it("can point at the download instead", () => {
    expect(activityHref({ ...DEFAULT_ACTIVITY_FILTERS, kind: "sign_ins", pages: 4 }, "/activity/export")).toBe(
      "/activity/export?action=sign_ins",
    );
  });
});

describe("withScope", () => {
  it("keeps the action when it's in the new app, and starts over at the first page", () => {
    const filters = { scope: "all", person: PERSON, kind: "downloads", pages: 3 } as const;
    expect(withScope(filters, "platform")).toEqual({ scope: "platform", person: PERSON, kind: "downloads", pages: 1 });
  });

  it("drops an action the new app doesn't have", () => {
    const filters = { scope: "all", person: null, kind: "payments", pages: 1 } as const;
    expect(withScope(filters, "platform").kind).toBe("all");
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
    const filters = { scope: "finances", person: PERSON, kind: "payments", pages: 1 } as const;
    expect(activityQuery(filters, scopesFor(["owner"]))).toEqual({
      scopes: ["finances"],
      actions: ["request.paid", "request.recorded_paid", "request.unpaid"],
      actorId: PERSON,
    });
  });

  it("finds downloads in both apps that have them", () => {
    const filters = { ...DEFAULT_ACTIVITY_FILTERS, kind: "downloads" } as const;
    expect(activityQuery(filters, scopesFor(["owner"])).actions).toEqual(["export.downloaded", "activity.exported"]);
  });
});
