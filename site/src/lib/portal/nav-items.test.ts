import { describe, expect, it } from "vitest";
import {
  ACCOUNT,
  ACTIVITY,
  allowedFor,
  ATTENDANCE,
  DASHBOARD,
  EMAIL,
  isActive,
  MAIN_ITEMS,
  MESSAGES,
  PEOPLE,
  PHOTOS,
  POSTS,
  SETTINGS,
  splitForTabBar,
  type NavItem,
} from "./nav-items";

const EVERY_ITEM = [DASHBOARD, POSTS, PHOTOS, ATTENDANCE, MESSAGES, EMAIL, PEOPLE, ACTIVITY, SETTINGS, ACCOUNT];
const labels = (items: NavItem[]) => items.map((item) => item.label);

describe("allowedFor", () => {
  it("shows an owner every item", () => {
    expect(EVERY_ITEM.filter(allowedFor(["owner"]))).toEqual(EVERY_ITEM);
  });

  it("shows a site editor the site's content, but not messages or owner tools", () => {
    expect(labels(EVERY_ITEM.filter(allowedFor(["site_editor"])))).toEqual([
      "Dashboard",
      "Posts",
      "Photos",
      "Activity",
      "Settings",
      "Account",
    ]);
  });

  it("shows the messages role only messages, past Dashboard, Settings, and Account", () => {
    expect(labels(EVERY_ITEM.filter(allowedFor(["site_messages"])))).toEqual([
      "Dashboard",
      "Messages",
      "Activity",
      "Settings",
      "Account",
    ]);
  });

  it("adds up the items of stacked roles", () => {
    expect(labels(EVERY_ITEM.filter(allowedFor(["site_editor", "site_messages"])))).toEqual([
      "Dashboard",
      "Posts",
      "Photos",
      "Messages",
      "Activity",
      "Settings",
      "Account",
    ]);
  });

  it("shows a finance viewer Dashboard, Attendance, Activity, Settings, and Account", () => {
    expect(labels(EVERY_ITEM.filter(allowedFor(["finance_viewer"])))).toEqual([
      "Dashboard",
      "Attendance",
      "Activity",
      "Settings",
      "Account",
    ]);
  });

  it("shows the Attendance role only Attendance, past Dashboard, Settings, and Account", () => {
    expect(labels(EVERY_ITEM.filter(allowedFor(["attendance"])))).toEqual([
      "Dashboard",
      "Attendance",
      "Settings",
      "Account",
    ]);
  });
});

describe("isActive", () => {
  it("matches Dashboard only on the home page", () => {
    expect(isActive("/", DASHBOARD)).toBe(true);
    expect(isActive("/account", DASHBOARD)).toBe(false);
  });

  it("matches a section and the pages inside it", () => {
    expect(isActive("/people", PEOPLE)).toBe(true);
    expect(isActive("/people/123", PEOPLE)).toBe(true);
  });

  it("lights up Posts for events too, since they live under it", () => {
    expect(isActive("/events", POSTS)).toBe(true);
    expect(isActive("/events/123", POSTS)).toBe(true);
    expect(isActive("/eventsx", POSTS)).toBe(false);
  });

  it("doesn't match a section that only starts with the same letters", () => {
    expect(isActive("/peoplex", PEOPLE)).toBe(false);
  });
});

describe("splitForTabBar", () => {
  it("puts up to four sections in the tab bar and the rest under More, before Settings and Account", () => {
    const { tabs, more } = splitForTabBar(MAIN_ITEMS.filter(allowedFor(["owner"])));
    expect(labels(tabs)).toEqual(["Dashboard", "Posts", "Photos", "Attendance"]);
    expect(labels(more)).toEqual(["Messages", "Email", "People", "Activity", "Settings", "Account"]);
  });

  it("keeps every section in the tab bar when they fit", () => {
    const { tabs, more } = splitForTabBar([DASHBOARD, MESSAGES]);
    expect(labels(tabs)).toEqual(["Dashboard", "Messages"]);
    expect(labels(more)).toEqual(["Settings", "Account"]);
  });
});

describe("MAIN_ITEMS", () => {
  it("lists every section an owner sees, in order", () => {
    expect(labels(MAIN_ITEMS.filter(allowedFor(["owner"])))).toEqual([
      "Dashboard",
      "Posts",
      "Photos",
      "Attendance",
      "Messages",
      "Email",
      "People",
      "Activity",
    ]);
  });

  it("has Activity for anyone whose roles show some", () => {
    expect(labels(MAIN_ITEMS.filter(allowedFor(["site_editor"])))).toEqual(["Dashboard", "Posts", "Photos", "Activity"]);
    expect(labels(MAIN_ITEMS.filter(allowedFor(["finance_viewer"])))).toEqual(["Dashboard", "Attendance", "Activity"]);
  });

  it("has Posts for site editors and owners", () => {
    expect(MAIN_ITEMS.filter(allowedFor(["site_editor"]))).toContain(POSTS);
    expect(MAIN_ITEMS.filter(allowedFor(["finance_viewer", "site_messages"]))).not.toContain(POSTS);
  });

  it("has Photos for site editors and owners", () => {
    expect(MAIN_ITEMS.filter(allowedFor(["site_editor"]))).toContain(PHOTOS);
    expect(MAIN_ITEMS.filter(allowedFor(["owner"]))).toContain(PHOTOS);
    expect(MAIN_ITEMS.filter(allowedFor(["finance_viewer", "site_messages"]))).not.toContain(PHOTOS);
  });

  it("has Messages for the Messages role and owners, and not for site editors without it", () => {
    expect(labels(MAIN_ITEMS.filter(allowedFor(["site_messages"])))).toEqual(["Dashboard", "Messages", "Activity"]);
    expect(MAIN_ITEMS.filter(allowedFor(["owner"]))).toContain(MESSAGES);
    expect(MAIN_ITEMS.filter(allowedFor(["site_editor", "finance_viewer"]))).not.toContain(MESSAGES);
  });

  it("has Attendance for the Attendance role, finance viewers, and owners", () => {
    expect(MAIN_ITEMS.filter(allowedFor(["attendance"]))).toContain(ATTENDANCE);
    expect(MAIN_ITEMS.filter(allowedFor(["finance_viewer"]))).toContain(ATTENDANCE);
    expect(MAIN_ITEMS.filter(allowedFor(["owner"]))).toContain(ATTENDANCE);
    expect(MAIN_ITEMS.filter(allowedFor(["site_editor", "site_messages"]))).not.toContain(ATTENDANCE);
  });

  it("has People for owners only", () => {
    expect(MAIN_ITEMS.filter(allowedFor(["owner"]))).toContain(PEOPLE);
    expect(
      MAIN_ITEMS.filter(allowedFor(["finance_viewer", "site_editor", "site_messages", "attendance"])),
    ).not.toContain(PEOPLE);
  });

  it("has Email for owners only", () => {
    expect(MAIN_ITEMS.filter(allowedFor(["owner"]))).toContain(EMAIL);
    expect(
      MAIN_ITEMS.filter(allowedFor(["finance_viewer", "site_editor", "site_messages", "attendance"])),
    ).not.toContain(EMAIL);
  });
});
