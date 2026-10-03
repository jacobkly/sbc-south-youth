import { describe, expect, it } from "vitest";
import { canUseFinances, canUsePortal, hasRole, roleSummary, ROLE_LABELS, sortRoles } from "./roles";

describe("hasRole", () => {
  it("finds a role the person holds", () => {
    expect(hasRole(["site_editor"], "site_editor")).toBe(true);
    expect(hasRole(["site_editor", "site_messages"], "site_messages")).toBe(true);
  });

  it("is true when any of several roles matches", () => {
    expect(hasRole(["site_messages"], "site_editor", "site_messages")).toBe(true);
  });

  it("is false for a role the person doesn't hold", () => {
    expect(hasRole(["finance_requester"], "site_editor")).toBe(false);
    expect(hasRole([], "site_editor")).toBe(false);
  });

  it("counts an owner as every role, like the database", () => {
    expect(hasRole(["owner"], "finance_viewer")).toBe(true);
    expect(hasRole(["owner"], "site_editor")).toBe(true);
    expect(hasRole(["owner"], "site_messages")).toBe(true);
  });
});

describe("canUsePortal", () => {
  it.each([["owner"], ["finance_viewer"], ["site_editor"], ["site_messages"]] as const)(
    "lets an active %s in",
    (role) => {
      expect(canUsePortal({ is_active: true, roles: [role] })).toBe(true);
    },
  );

  it("keeps out someone who only requests reimbursements", () => {
    expect(canUsePortal({ is_active: true, roles: ["finance_requester"] })).toBe(false);
  });

  it("keeps out someone with no roles", () => {
    expect(canUsePortal({ is_active: true, roles: [] })).toBe(false);
  });

  it("keeps out someone whose access was removed, whatever their roles", () => {
    expect(canUsePortal({ is_active: false, roles: ["owner"] })).toBe(false);
  });
});

describe("canUseFinances", () => {
  it("includes requesters, viewers, and owners", () => {
    expect(canUseFinances(["finance_requester"])).toBe(true);
    expect(canUseFinances(["finance_viewer"])).toBe(true);
    expect(canUseFinances(["owner"])).toBe(true);
  });

  it("leaves out the site-only roles", () => {
    expect(canUseFinances(["site_editor", "site_messages"])).toBe(false);
  });
});

describe("sortRoles", () => {
  it("puts roles in the order the portal lists them", () => {
    expect(sortRoles(["site_messages", "finance_requester", "site_editor"])).toEqual([
      "finance_requester",
      "site_editor",
      "site_messages",
    ]);
  });

  it("drops repeats", () => {
    expect(sortRoles(["site_editor", "site_editor"])).toEqual(["site_editor"]);
  });
});

describe("roleSummary", () => {
  it("names an owner as just the owner", () => {
    expect(roleSummary(["site_editor", "owner"])).toBe(ROLE_LABELS.owner);
  });

  it("lists every other role in order", () => {
    expect(roleSummary(["site_messages", "site_editor"])).toBe("Site editor, Messages");
  });

  it("says so when there are none", () => {
    expect(roleSummary([])).toBe("No roles");
  });
});
