import { describe, expect, it } from "vitest";
import { DEFAULT_PAYEE_VIEW, parsePayeeView, payeesHref } from "./view";

function roundTrip(href: string) {
  return parsePayeeView(Object.fromEntries(new URL(href, "http://x").searchParams));
}

describe("parsePayeeView", () => {
  it("falls back to active payees by name with no search", () => {
    expect(parsePayeeView({})).toEqual({ sort: "name", status: "active", q: "" });
    expect(parsePayeeView({})).toEqual(DEFAULT_PAYEE_VIEW);
  });

  it("reads the sort, tab, and search", () => {
    expect(parsePayeeView({ sort: "paid", status: "inactive", q: "pat" })).toEqual({
      sort: "paid",
      status: "inactive",
      q: "pat",
    });
  });

  it("takes the first of a repeated value", () => {
    expect(parsePayeeView({ sort: ["newest", "paid"], status: ["inactive", "active"] })).toMatchObject({
      sort: "newest",
      status: "inactive",
    });
  });

  it("ignores values it doesn't know", () => {
    expect(parsePayeeView({ sort: "loudest", status: "archived" })).toEqual(DEFAULT_PAYEE_VIEW);
  });

  it("trims the search and caps its length", () => {
    expect(parsePayeeView({ q: "  sam  " }).q).toBe("sam");
    expect(parsePayeeView({ q: "a".repeat(150) }).q).toHaveLength(100);
  });
});

describe("payeesHref", () => {
  it("leaves the defaults out of the URL", () => {
    expect(payeesHref(DEFAULT_PAYEE_VIEW)).toBe("/admin/payees");
    expect(payeesHref({ ...DEFAULT_PAYEE_VIEW, q: "   " })).toBe("/admin/payees");
  });

  it("keeps each non-default part", () => {
    expect(payeesHref({ ...DEFAULT_PAYEE_VIEW, sort: "paid" })).toBe("/admin/payees?sort=paid");
    expect(payeesHref({ ...DEFAULT_PAYEE_VIEW, status: "inactive" })).toBe("/admin/payees?status=inactive");
    expect(payeesHref({ ...DEFAULT_PAYEE_VIEW, q: " pat " })).toBe("/admin/payees?q=pat");
  });

  it("round-trips through the URL, including characters that need escaping", () => {
    const view = { sort: "newest", status: "inactive", q: "O'Neil & Sons #2" } as const;
    expect(roundTrip(payeesHref(view))).toEqual(view);
  });
});
