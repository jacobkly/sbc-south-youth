import { describe, expect, it } from "vitest";
import {
  ACCOUNT,
  ACTIVITY,
  DASHBOARD,
  isActive,
  MY_NEW_REQUEST,
  MY_REQUESTS,
  navFor,
  NEW_REQUEST,
  PAYEES,
  REPORTS,
  REQUESTS,
  SETTINGS,
} from "./nav-items";

describe("navFor", () => {
  it("shows admins every team page", () => {
    const nav = navFor({ role: "admin", requester: false });
    expect(nav.home).toBe(DASHBOARD);
    expect(nav.create).toBe(NEW_REQUEST);
    expect(nav.tabs).toEqual([DASHBOARD, REQUESTS, NEW_REQUEST, PAYEES]);
    expect(nav.more).toEqual([REPORTS, ACTIVITY, SETTINGS, ACCOUNT]);
    expect(nav.main).toEqual([DASHBOARD, REQUESTS, PAYEES, REPORTS, ACTIVITY]);
    expect(nav.footer).toEqual([SETTINGS]);
  });

  it("hides the admin-only pages from viewers", () => {
    const nav = navFor({ role: "viewer", requester: false });
    expect(nav.create).toBeNull();
    expect(nav.tabs).toEqual([DASHBOARD, REQUESTS, PAYEES]);
    expect(nav.more).toEqual([REPORTS, SETTINGS, ACCOUNT]);
    expect(nav.main).toEqual([DASHBOARD, REQUESTS, PAYEES, REPORTS]);
  });

  it("gives a viewer who also requests their own requests, and a new one of their own", () => {
    const nav = navFor({ role: "viewer", requester: true });
    expect(nav.create).toBe(MY_NEW_REQUEST);
    expect(nav.tabs).toEqual([DASHBOARD, REQUESTS, MY_NEW_REQUEST, PAYEES]);
    expect(nav.more).toEqual([MY_REQUESTS, REPORTS, SETTINGS, ACCOUNT]);
    expect(nav.main).toEqual([DASHBOARD, REQUESTS, PAYEES, REPORTS, MY_REQUESTS]);
  });

  it("adds My requests for an admin who's also a requester, keeping the team's New", () => {
    const nav = navFor({ role: "admin", requester: true });
    expect(nav.create).toBe(NEW_REQUEST);
    expect(nav.more[0]).toBe(MY_REQUESTS);
    expect(nav.main.at(-1)).toBe(MY_REQUESTS);
  });

  it("gives someone who only requests just their requests and account", () => {
    const nav = navFor({ role: "member", requester: true });
    expect(nav.home).toBe(MY_REQUESTS);
    expect(nav.create).toBe(MY_NEW_REQUEST);
    expect(nav.tabs).toEqual([MY_REQUESTS, MY_NEW_REQUEST]);
    expect(nav.more).toEqual([ACCOUNT]);
    expect(nav.main).toEqual([MY_REQUESTS]);
    expect(nav.footer).toEqual([]);
  });
});

describe("isActive", () => {
  it("marks the dashboard only on itself", () => {
    expect(isActive("/admin", DASHBOARD.href)).toBe(true);
    expect(isActive("/admin/requests", DASHBOARD.href)).toBe(false);
  });

  it("marks a list on its pages, but not on New", () => {
    expect(isActive("/admin/requests/r1", REQUESTS.href)).toBe(true);
    expect(isActive("/admin/requests/new", REQUESTS.href)).toBe(false);
    expect(isActive("/my/r1", MY_REQUESTS.href)).toBe(true);
    expect(isActive("/my/r1/edit", MY_REQUESTS.href)).toBe(true);
    expect(isActive("/my/new", MY_REQUESTS.href)).toBe(false);
    expect(isActive("/my/new", MY_NEW_REQUEST.href)).toBe(true);
  });

  it("doesn't mix up paths that only start the same", () => {
    expect(isActive("/myself", MY_REQUESTS.href)).toBe(false);
  });
});
