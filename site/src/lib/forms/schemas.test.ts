import { describe, expect, it } from "vitest";
import { serveAreas } from "@/content/serve-areas";
import { checkMessage, contactRoles, isPhone, limits, readMessageInput, type MessageInput } from "./schemas";

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) [value].flat().forEach((one) => data.append(name, one));
  return data;
}

const maya = { name: "Maya Example", email: "maya@example.com" };

describe("readMessageInput", () => {
  it("trims each field and leaves blanks out", () => {
    expect(readMessageInput(form({ name: "  Maya  ", email: " ", phone: "", message: "\n Hi \n" }))).toEqual({
      name: "Maya",
      message: "Hi",
    });
  });

  it("collects every checked area", () => {
    expect(readMessageInput(form({ areas: ["media", "worship", ""] })).areas).toEqual(["media", "worship"]);
  });

  it("counts a line break as one character, however the browser sent it", () => {
    expect(readMessageInput(form({ message: "one\r\ntwo" })).message).toBe("one\ntwo");
  });

  it("ignores fields no form has", () => {
    expect(readMessageInput(form({ name: "Maya", gradeBand: "hs", admin: "yes" }))).toEqual({ name: "Maya" });
  });
});

describe("isPhone", () => {
  it.each(["555-555-0123", "(555) 555-0123", "+1 555 555 0123", "5555550123"])("accepts %j", (value) => {
    expect(isPhone(value)).toBe(true);
  });

  it.each(["555-0123", "call me", "555-555-0123 ext 4", "1234567890123456"])("rejects %j", (value) => {
    expect(isPhone(value)).toBe(false);
  });
});

describe("checkMessage: contact", () => {
  const valid: MessageInput = { ...maya, role: "parent", message: "When is pickup?" };

  it("accepts a full message", () => {
    expect(checkMessage("contact", valid)).toEqual({ ok: true, message: { kind: "contact", ...valid } });
  });

  it("names every problem at once", () => {
    expect(checkMessage("contact", {})).toEqual({
      ok: false,
      errors: {
        name: "Add your name.",
        email: "Add your email so we can write back.",
        role: "Pick one.",
        message: "Write a message.",
      },
    });
  });

  it("says when an email or phone doesn't look right", () => {
    const result = checkMessage("contact", { ...valid, email: "maya@", phone: "555" });
    expect(result).toEqual({
      ok: false,
      errors: {
        email: "That email doesn't look right.",
        phone: "Add the area code, like 555-555-0123.",
      },
    });
  });

  it("keeps the phone when there is one", () => {
    const result = checkMessage("contact", { ...valid, phone: "555-555-0123" });
    expect(result.ok && result.message.phone).toBe("555-555-0123");
  });

  it("limits the message and the name", () => {
    const result = checkMessage("contact", {
      ...valid,
      name: "M".repeat(limits.name + 1),
      message: "x".repeat(limits.message + 1),
    });
    expect(result).toEqual({
      ok: false,
      errors: {
        name: `Keep it under ${limits.name} characters.`,
        message: `Keep it under ${limits.message} characters.`,
      },
    });
  });

  it("asks if you're a student, a parent, or someone else", () => {
    expect(contactRoles).toEqual(["student", "parent", "other"]);
    for (const role of contactRoles) expect(checkMessage("contact", { ...valid, role }).ok).toBe(true);
  });

  it("only takes the choices on the form", () => {
    for (const role of ["hs", "college", "leader"]) {
      expect(checkMessage("contact", { ...valid, role })).toEqual({ ok: false, errors: { role: "Pick one." } });
    }
  });
});

describe("checkMessage: visit", () => {
  it("needs only a name and an email or a phone", () => {
    expect(checkMessage("visit", { name: "Maya" })).toEqual({
      ok: false,
      errors: { reach: "Add an email or a phone number." },
    });
    expect(checkMessage("visit", { name: "Maya", phone: "555-555-0123" })).toEqual({
      ok: true,
      message: { kind: "visit", name: "Maya", phone: "555-555-0123" },
    });
  });

  it("keeps the note short", () => {
    expect(checkMessage("visit", { ...maya, message: "x".repeat(limits.note + 1) })).toEqual({
      ok: false,
      errors: { message: `Keep it under ${limits.note} characters.` },
    });
  });
});

describe("checkMessage: join", () => {
  it("needs only a name and an email or a phone", () => {
    expect(checkMessage("join", {})).toEqual({
      ok: false,
      errors: { name: "Add your name.", reach: "Add an email or a phone number." },
    });
    expect(checkMessage("join", maya)).toEqual({ ok: true, message: { kind: "join", ...maya } });
  });

  it("keeps high school or college when someone says", () => {
    const result = checkMessage("join", { ...maya, band: "hs" });
    expect(result.ok && result.message.band).toBe("hs");
  });

  it("only takes high school or college", () => {
    expect(checkMessage("join", { ...maya, band: "parent" })).toEqual({
      ok: false,
      errors: { band: "Pick high school or college." },
    });
  });
});

describe("checkMessage: serve", () => {
  it("needs at least one area", () => {
    expect(checkMessage("serve", maya)).toEqual({
      ok: false,
      errors: { areas: "Pick at least one area." },
    });
  });

  it("only takes areas on the list", () => {
    expect(checkMessage("serve", { ...maya, areas: ["cafe", "nope"] })).toEqual({
      ok: false,
      errors: { areas: "Pick areas from the list." },
    });
  });

  it("takes any areas on the list, for anyone", () => {
    const every = serveAreas.map((area) => area.id);
    const result = checkMessage("serve", { ...maya, areas: every });
    expect(result.ok && result.message.areas).toEqual(every);
  });
});

describe("serveAreas", () => {
  it("lists the areas in a steady order, with Other last", () => {
    expect(serveAreas.map((area) => area.title)).toEqual(["Worship", "Cafe", "Greeting", "Ushers", "Media", "Other"]);
  });
});
