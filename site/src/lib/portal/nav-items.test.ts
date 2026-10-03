import { describe, expect, it } from "vitest";
import {
  ACCOUNT,
  ACTIVITY,
  allowedFor,
  comingSoonFor,
  EMAIL,
  HOME,
  isActive,
  MESSAGES,
  PEOPLE,
  PHOTOS,
  POSTS,
  splitForTabBar,
  type NavItem,
} from "./nav-items";

const EVERY_ITEM = [HOME, POSTS, PHOTOS, MESSAGES, ACTIVITY, PEOPLE, EMAIL, ACCOUNT];
const labels = (items: NavItem[]) => items.map((item) => item.label);

describe("allowedFor", () => {
  it("shows an owner every item", () => {
    expect(EVERY_ITEM.filter(allowedFor(["owner"]))).toEqual(EVERY_ITEM);
  });

  it("shows a site editor the site's content, but not messages or owner tools", () => {
    expect(labels(EVERY_ITEM.filter(allowedFor(["site_editor"])))).toEqual([
      "Home",
      "Posts",
      "Photos",
      "Activity",
      "Account",
    ]);
  });

  it("shows the messages role only messages, past Home and Account", () => {
    expect(labels(EVERY_ITEM.filter(allowedFor(["site_messages"])))).toEqual([
      "Home",
      "Messages",
      "Activity",
      "Account",
    ]);
  });

  it("adds up the items of stacked roles", () => {
    expect(labels(EVERY_ITEM.filter(allowedFor(["site_editor", "site_messages"])))).toEqual([
      "Home",
      "Posts",
      "Photos",
      "Messages",
      "Activity",
      "Account",
    ]);
  });

  it("shows a finance viewer Home, Activity, and Account", () => {
    expect(labels(EVERY_ITEM.filter(allowedFor(["finance_viewer"])))).toEqual(["Home", "Activity", "Account"]);
  });
});

describe("isActive", () => {
  it("matches Home only on the home page", () => {
    expect(isActive("/", HOME.href)).toBe(true);
    expect(isActive("/account", HOME.href)).toBe(false);
  });

  it("matches a section and the pages inside it", () => {
    expect(isActive("/people", PEOPLE.href)).toBe(true);
    expect(isActive("/people/123", PEOPLE.href)).toBe(true);
  });

  it("doesn't match a section that only starts with the same letters", () => {
    expect(isActive("/peoplex", PEOPLE.href)).toBe(false);
  });
});

describe("splitForTabBar", () => {
  it("puts up to four sections in the tab bar and the rest under More, before Account", () => {
    const { tabs, more } = splitForTabBar([HOME, POSTS, PHOTOS, MESSAGES, ACTIVITY, PEOPLE, EMAIL]);
    expect(labels(tabs)).toEqual(["Home", "Posts", "Photos", "Messages"]);
    expect(labels(more)).toEqual(["Activity", "People", "Email", "Account"]);
  });

  it("keeps every section in the tab bar when they fit", () => {
    const { tabs, more } = splitForTabBar([HOME, MESSAGES]);
    expect(labels(tabs)).toEqual(["Home", "Messages"]);
    expect(labels(more)).toEqual(["Account"]);
  });
});

describe("comingSoonFor", () => {
  it("lists the sections a person's roles will get that aren't built yet", () => {
    expect(labels(comingSoonFor(["site_messages"]))).toEqual(["Messages", "Activity"]);
  });

  it("never lists a built section", () => {
    expect(comingSoonFor(["owner"])).not.toContain(HOME);
  });
});
