import { describe, expect, it } from "vitest";
import { financeRoleFrom } from "./roles";

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
