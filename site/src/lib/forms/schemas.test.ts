import { describe, expect, it } from "vitest";
import { checkMessage, isPhone, limits, readMessageInput, type MessageInput } from "./schemas";

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

  it("collects every checked team", () => {
    expect(readMessageInput(form({ teams: ["tech", "welcome", ""] })).teams).toEqual(["tech", "welcome"]);
  });

  it("counts a line break as one character, however the browser sent it", () => {
    expect(readMessageInput(form({ message: "one\r\ntwo" })).message).toBe("one\ntwo");
  });

  it("ignores fields no form has", () => {
    expect(readMessageInput(form({ name: "Maya", role: "admin" }))).toEqual({ name: "Maya" });
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
  const valid: MessageInput = { ...maya, gradeBand: "parent", message: "When is pickup?" };

  it("accepts a full message", () => {
    expect(checkMessage("contact", valid)).toEqual({ ok: true, message: { kind: "contact", ...valid } });
  });

  it("names every problem at once", () => {
    expect(checkMessage("contact", {})).toEqual({
      ok: false,
      errors: {
        name: "Add your name.",
        email: "Add your email so we can write back.",
        gradeBand: "Pick one.",
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

  it("only takes the choices on the form", () => {
    expect(checkMessage("contact", { ...valid, gradeBand: "leader" })).toEqual({
      ok: false,
      errors: { gradeBand: "Pick one." },
    });
  });
});

describe("checkMessage: visit", () => {
  it("needs an email or a phone, not both", () => {
    expect(checkMessage("visit", { name: "Maya", gradeBand: "hs" })).toEqual({
      ok: false,
      errors: { reach: "Add an email or a phone number." },
    });
    expect(checkMessage("visit", { name: "Maya", gradeBand: "hs", phone: "555-555-0123" }).ok).toBe(true);
  });

  it("only takes high school or college", () => {
    expect(checkMessage("visit", { ...maya, gradeBand: "parent" })).toEqual({
      ok: false,
      errors: { gradeBand: "Pick high school or college." },
    });
  });

  it("keeps the note short", () => {
    expect(checkMessage("visit", { ...maya, gradeBand: "college", message: "x".repeat(limits.note + 1) })).toEqual({
      ok: false,
      errors: { message: `Keep it under ${limits.note} characters.` },
    });
  });
});

describe("checkMessage: join", () => {
  const college: MessageInput = { ...maya, gradeBand: "college", group: "chat" };

  it("needs a parent or guardian's email for high school", () => {
    expect(checkMessage("join", { ...college, gradeBand: "hs" })).toEqual({
      ok: false,
      errors: { parentEmail: "Add a parent or guardian's email." },
    });
    const result = checkMessage("join", { ...college, gradeBand: "hs", parentEmail: "parent@example.com" });
    expect(result.ok && result.message.parentEmail).toBe("parent@example.com");
  });

  it("won't take the student's own email as the parent's", () => {
    expect(checkMessage("join", { ...college, gradeBand: "hs", parentEmail: "MAYA@example.com" })).toEqual({
      ok: false,
      errors: { parentEmail: "Use a parent's or guardian's email, not yours." },
    });
  });

  it("doesn't keep a parent's email for college", () => {
    const result = checkMessage("join", { ...college, parentEmail: "parent@example.com" });
    expect(result).toEqual({ ok: true, message: { kind: "join", ...college } });
  });

  it("asks which group", () => {
    expect(checkMessage("join", { ...college, group: undefined })).toEqual({
      ok: false,
      errors: { group: "Pick one." },
    });
  });

  it("reports the reach and parent rules alongside field errors", () => {
    expect(checkMessage("join", { gradeBand: "hs", group: "both" })).toEqual({
      ok: false,
      errors: {
        name: "Add your name.",
        reach: "Add an email or a phone number.",
        parentEmail: "Add a parent or guardian's email.",
      },
    });
  });
});

describe("checkMessage: serve", () => {
  it("needs at least one team", () => {
    expect(checkMessage("serve", { ...maya, gradeBand: "hs" })).toEqual({
      ok: false,
      errors: { teams: "Pick at least one team." },
    });
  });

  it("only takes teams offered to that grade band", () => {
    expect(checkMessage("serve", { ...maya, gradeBand: "hs", teams: ["tech", "small-groups"] })).toEqual({
      ok: false,
      errors: { teams: "Pick teams from the list." },
    });
    expect(checkMessage("serve", { ...maya, gradeBand: "hs", teams: ["tech", "nope"] })).toEqual({
      ok: false,
      errors: { teams: "Pick teams from the list." },
    });
  });

  it("accepts teams for the grade band", () => {
    const result = checkMessage("serve", { ...maya, gradeBand: "college", teams: ["small-groups", "tech"] });
    expect(result.ok && result.message.teams).toEqual(["small-groups", "tech"]);
  });
});
