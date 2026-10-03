import { describe, expect, it } from "vitest";
import { canUseArea, financeRoleFrom, financeRoleLabel, homePathFor } from "./roles";

describe("financeRoleFrom", () => {
  it("makes an owner an admin, whatever else they hold", () => {
    expect(financeRoleFrom(["owner"])).toBe("admin");
    expect(financeRoleFrom(["finance_viewer", "owner", "site_editor"])).toBe("admin");
  });

  it("makes a finance viewer a viewer, even with other roles", () => {
    expect(financeRoleFrom(["finance_viewer"])).toBe("viewer");
    expect(financeRoleFrom(["site_editor", "finance_requester", "finance_viewer"])).toBe("viewer");
  });

  it("leaves everyone else a member", () => {
    expect(financeRoleFrom([])).toBe("member");
    expect(financeRoleFrom(["finance_requester"])).toBe("member");
    expect(financeRoleFrom(["site_editor", "site_messages"])).toBe("member");
  });
});

describe("financeRoleLabel", () => {
  it("names the team roles", () => {
    expect(financeRoleLabel(["owner"])).toBe("Admin");
    expect(financeRoleLabel(["finance_viewer", "finance_requester"])).toBe("Viewer");
  });

  it("calls someone who only requests a requester", () => {
    expect(financeRoleLabel(["finance_requester"])).toBe("Requester");
    expect(financeRoleLabel(["site_editor", "finance_requester"])).toBe("Requester");
  });

  it("calls anyone else a member", () => {
    expect(financeRoleLabel(["site_editor"])).toBe("Member");
  });
});

describe("canUseArea", () => {
  const person = (roles: Parameters<typeof financeRoleFrom>[0], is_active = true) => ({ roles, is_active });

  it("lets owners in everywhere, since owner counts as every role", () => {
    for (const area of ["team", "requests", "account"] as const) {
      expect(canUseArea(person(["owner"]), area)).toBe(true);
    }
  });

  it("keeps viewers to the team pages and their account", () => {
    expect(canUseArea(person(["finance_viewer"]), "team")).toBe(true);
    expect(canUseArea(person(["finance_viewer"]), "account")).toBe(true);
    expect(canUseArea(person(["finance_viewer"]), "requests")).toBe(false);
  });

  it("keeps requesters to their own requests and their account", () => {
    expect(canUseArea(person(["finance_requester"]), "requests")).toBe(true);
    expect(canUseArea(person(["finance_requester"]), "account")).toBe(true);
    expect(canUseArea(person(["finance_requester"]), "team")).toBe(false);
  });

  it("lets a viewer who also requests use both", () => {
    const both = person(["finance_viewer", "finance_requester"]);
    expect(canUseArea(both, "team")).toBe(true);
    expect(canUseArea(both, "requests")).toBe(true);
  });

  it("keeps out anyone without a finance role", () => {
    for (const area of ["team", "requests", "account"] as const) {
      expect(canUseArea(person(["site_editor", "site_messages"]), area)).toBe(false);
      expect(canUseArea(person([]), area)).toBe(false);
    }
  });

  it("keeps out anyone whose access was removed, roles and all", () => {
    for (const area of ["team", "requests", "account"] as const) {
      expect(canUseArea(person(["owner"], false), area)).toBe(false);
      expect(canUseArea(person(["finance_requester"], false), area)).toBe(false);
    }
  });
});

describe("homePathFor", () => {
  it("sends owners and viewers to the dashboard", () => {
    expect(homePathFor({ roles: ["owner"], is_active: true })).toBe("/admin");
    expect(homePathFor({ roles: ["finance_viewer", "finance_requester"], is_active: true })).toBe("/admin");
  });

  it("sends someone who only requests to their requests", () => {
    expect(homePathFor({ roles: ["finance_requester"], is_active: true })).toBe("/my");
  });

  it("sends anyone else to the dashboard, which says they have no access", () => {
    expect(homePathFor({ roles: ["site_editor"], is_active: true })).toBe("/admin");
    expect(homePathFor({ roles: ["finance_requester"], is_active: false })).toBe("/admin");
  });
});
