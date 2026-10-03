import { describe, expect, it } from "vitest";
import {
  DEFAULT_MESSAGE_FILTERS,
  MAX_MESSAGE_PAGES,
  messagePreview,
  messagesHref,
  newMessagesText,
  parseMessageFilters,
  phoneHref,
  statusesFor,
  tabOf,
  type MessageRow,
} from "./list";

const message = (changes: Partial<MessageRow> = {}): MessageRow => ({
  id: "00000000-0000-4000-8000-000000000001",
  kind: "contact",
  name: "Lee Example",
  email: "lee@example.test",
  phone: null,
  message: "When is camp?",
  details: {},
  env: "production",
  status: "new",
  outcome: null,
  assigned_to: null,
  internal_note: null,
  handled_by: null,
  handled_at: null,
  notified_at: null,
  created_at: "2026-10-02T22:14:00Z",
  ...changes,
});

describe("statusesFor and tabOf", () => {
  it("puts spam with handled, since both are closed", () => {
    expect(statusesFor("handled")).toEqual(["handled", "spam"]);
    expect(tabOf("spam")).toBe("handled");
    expect(tabOf("handled")).toBe("handled");
  });

  it("gives each open status its own tab", () => {
    expect(statusesFor("new")).toEqual(["new"]);
    expect(statusesFor("in_progress")).toEqual(["in_progress"]);
    expect(tabOf("new")).toBe("new");
    expect(tabOf("in_progress")).toBe("in_progress");
  });
});

describe("parseMessageFilters", () => {
  it("starts on new production messages of every kind", () => {
    expect(parseMessageFilters({})).toEqual(DEFAULT_MESSAGE_FILTERS);
    expect(DEFAULT_MESSAGE_FILTERS).toEqual({ tab: "new", kind: "all", env: "production", pages: 1 });
  });

  it("reads the tab, kind, staging, and pages from the URL", () => {
    expect(parseMessageFilters({ tab: "handled", kind: "serve", env: "staging", pages: "3" })).toEqual({
      tab: "handled",
      kind: "serve",
      env: "staging",
      pages: 3,
    });
  });

  it("falls back to the defaults for anything it doesn't know", () => {
    expect(parseMessageFilters({ tab: "spam", kind: "email", env: "dev", pages: "two" })).toEqual(
      DEFAULT_MESSAGE_FILTERS,
    );
  });

  it("keeps the page count in range", () => {
    expect(parseMessageFilters({ pages: "0" }).pages).toBe(1);
    expect(parseMessageFilters({ pages: "999" }).pages).toBe(MAX_MESSAGE_PAGES);
  });

  it("takes the first of a repeated parameter", () => {
    expect(parseMessageFilters({ tab: ["in_progress", "handled"] }).tab).toBe("in_progress");
  });
});

describe("messagesHref", () => {
  it("leaves out the defaults", () => {
    expect(messagesHref(DEFAULT_MESSAGE_FILTERS)).toBe("/messages");
  });

  it("keeps every filter that isn't a default", () => {
    expect(messagesHref({ tab: "in_progress", kind: "takedown", env: "staging", pages: 2 })).toBe(
      "/messages?tab=in_progress&kind=takedown&env=staging&pages=2",
    );
  });

  it("goes back to the first page when a filter changes", () => {
    const filters = { ...DEFAULT_MESSAGE_FILTERS, pages: 3 };
    expect(messagesHref(filters, { tab: "handled" })).toBe("/messages?tab=handled");
    expect(messagesHref(filters, { pages: 4 })).toBe("/messages?pages=4");
  });

  it("round-trips through parseMessageFilters", () => {
    const filters = { tab: "handled", kind: "join", env: "staging", pages: 2 } as const;
    const query = new URLSearchParams(messagesHref(filters).split("?")[1]);
    expect(parseMessageFilters(Object.fromEntries(query))).toEqual(filters);
  });
});

describe("messagePreview", () => {
  it("shows what they wrote", () => {
    expect(messagePreview(message())).toBe("When is camp?");
  });

  it("shows the form's answers when they wrote nothing", () => {
    expect(messagePreview(message({ kind: "serve", message: null, details: { areas: ["media", "cafe"] } }))).toBe(
      "Serve in: Media, Cafe",
    );
    expect(messagePreview(message({ kind: "join", message: null, details: { band: "college" } }))).toBe(
      "School: In college",
    );
  });

  it("says so when there's nothing else to show", () => {
    expect(messagePreview(message({ kind: "visit", message: "  ", details: {} }))).toBe("No message");
  });
});

describe("phoneHref", () => {
  it("calls or texts a US number with its country code", () => {
    expect(phoneHref("(206) 555-0102", "tel")).toBe("tel:+12065550102");
    expect(phoneHref("206.555.0102", "sms")).toBe("sms:+12065550102");
    expect(phoneHref("1 206 555 0102", "tel")).toBe("tel:+12065550102");
  });

  it("keeps an international number as written, digits only", () => {
    expect(phoneHref("+44 20 7946 0958", "tel")).toBe("tel:+442079460958");
  });

  it("gives nothing for a number too short to dial", () => {
    expect(phoneHref("555", "tel")).toBeNull();
    expect(phoneHref("call me", "sms")).toBeNull();
  });
});

describe("newMessagesText", () => {
  it("counts what's waiting, or says there's nothing", () => {
    expect(newMessagesText(0)).toBe("You're all caught up.");
    expect(newMessagesText(1)).toBe("1 new message is waiting.");
    expect(newMessagesText(1200)).toBe("1,200 new messages are waiting.");
  });
});
