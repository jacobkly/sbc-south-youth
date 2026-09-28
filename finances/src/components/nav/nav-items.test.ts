import { describe, expect, it } from "vitest";
import { ACTIVITY, allowedFor, NEW_REQUEST, REPORTS } from "./nav-items";

describe("allowedFor", () => {
  it("shows admins every item", () => {
    const allowed = allowedFor("admin");
    expect([NEW_REQUEST, REPORTS, ACTIVITY].every(allowed)).toBe(true);
  });

  it("hides the admin-only items from viewers", () => {
    const allowed = allowedFor("viewer");
    expect(allowed(REPORTS)).toBe(true);
    expect(allowed(NEW_REQUEST)).toBe(false);
    expect(allowed(ACTIVITY)).toBe(false);
  });
});
