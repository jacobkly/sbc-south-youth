import { describe, expect, it } from "vitest";
import { submitMessage } from "./actions";
import { ELAPSED_FIELD, HONEYPOT_FIELD, MIN_FILL_MS } from "./guard";
import type { MessageKind } from "./schemas";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

const person = {
  name: "Maya  Example",
  email: "maya@example.com",
  gradeBand: "parent",
  message: "When is pickup?",
  [ELAPSED_FIELD]: String(MIN_FILL_MS + 5000),
};

describe("submitMessage", () => {
  it("thanks a person by their first name", async () => {
    expect(await submitMessage("contact", form(person))).toEqual({ status: "sent", firstName: "Maya" });
  });

  it("sends back every problem with the fields", async () => {
    expect(await submitMessage("contact", form({ ...person, email: "", message: "" }))).toEqual({
      status: "invalid",
      errors: { email: "Add your email so we can write back.", message: "Write a message." },
    });
  });

  it("looks the same to a bot that filled in the honeypot", async () => {
    expect(await submitMessage("contact", form({ ...person, [HONEYPOT_FIELD]: "https://spam.example" }))).toEqual({
      status: "sent",
      firstName: "Maya",
    });
  });

  it("refuses a form that doesn't exist", async () => {
    expect(await submitMessage("prayer" as MessageKind, form(person))).toEqual({
      status: "failed",
      message: "That form doesn't exist.",
    });
  });
});
