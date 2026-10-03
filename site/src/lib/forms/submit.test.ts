import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { failures } from "@/content/forms";
import { site } from "@/content/site";
import type { FormEnv } from "@/lib/env";
import { ELAPSED_FIELD, HONEYPOT_FIELD, MIN_FILL_MS, TURNSTILE_FIELD } from "./guard";
import type { MessageKind } from "./schemas";
import { handleMessage, type SaveInput, type SubmitDeps } from "./submit";

const READY: FormEnv = {
  appEnv: "production",
  turnstileSecret: "0x4AAAAAAAexample-secret",
  ipSalt: "an-example-salt-that-is-long-enough",
  alertTo: "youth@example.test",
};

const IP = "203.0.113.7";
const MESSAGE_ID = "00000000-0000-4000-8000-0000000000d1";

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const each of Array.isArray(value) ? value : [value]) data.append(name, each);
  }
  return data;
}

const person = {
  name: "Maya Example",
  email: "maya@example.test",
  role: "parent",
  message: "When is pickup?",
  [ELAPSED_FIELD]: String(MIN_FILL_MS + 5000),
  [TURNSTILE_FIELD]: "good-token",
};

/** The database, Turnstile, and the drain, recording what each was asked. */
function fakes(overrides: Partial<SubmitDeps> = {}) {
  const saved: SaveInput[] = [];
  const verified: { token: string | null; ip: string | null; secret: string }[] = [];
  const reports: { source: string; message: string }[] = [];
  let drains = 0;
  const deps: SubmitDeps = {
    env: () => READY,
    ip: IP,
    verify: async (token, ip, secret) => {
      verified.push({ token, ip, secret });
      return token === "good-token";
    },
    save: async (input) => {
      saved.push(input);
      return { status: "saved", id: MESSAGE_ID };
    },
    sendAlerts: () => {
      drains++;
    },
    report: (source, error) => {
      reports.push({ source, message: error instanceof Error ? error.message : String(error) });
    },
    ...overrides,
  };
  return { deps, saved, verified, reports, drains: () => drains };
}

const hash = (ip: string, salt = READY.ipSalt!) => createHmac("sha256", salt).update(ip).digest("hex");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleMessage", () => {
  it("saves a person's message and thanks them by their first name", async () => {
    const { deps, saved } = fakes();

    expect(await handleMessage("contact", form(person), deps)).toEqual({ status: "sent", firstName: "Maya" });
    expect(saved).toEqual([
      {
        kind: "contact",
        payload: { name: "Maya Example", email: "maya@example.test", role: "parent", message: "When is pickup?" },
        ipHash: hash(IP),
        env: "production",
        alertTo: "youth@example.test",
      },
    ]);
  });

  it("keeps a salted hash of the sender's address, never the address", async () => {
    const { deps, saved } = fakes();
    const other = fakes({ env: () => ({ ...READY, ipSalt: "a-different-salt-that-is-long-enough" }) });

    await handleMessage("contact", form(person), deps);
    await handleMessage("contact", form(person), other.deps);
    expect(saved[0].ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(saved[0])).not.toContain(IP);
    expect(other.saved[0].ipHash).not.toBe(saved[0].ipHash);
  });

  it("checks Turnstile with the sender's address before saving", async () => {
    const { deps, verified } = fakes();

    await handleMessage("contact", form(person), deps);
    expect(verified).toEqual([{ token: "good-token", ip: IP, secret: READY.turnstileSecret }]);
  });

  it("sends the alert right after saving", async () => {
    const { deps, drains } = fakes();

    await handleMessage("contact", form(person), deps);
    expect(drains()).toBe(1);
  });

  it("saves each form's own fields", async () => {
    const { deps, saved } = fakes();
    const reach = { name: "Sam Example", phone: "555-555-0123", [ELAPSED_FIELD]: person[ELAPSED_FIELD] };

    await handleMessage("visit", form({ ...reach, message: "Coming Friday", [TURNSTILE_FIELD]: "good-token" }), deps);
    await handleMessage("join", form({ ...reach, band: "hs", [TURNSTILE_FIELD]: "good-token" }), deps);
    const areas = ["worship", "media"];
    await handleMessage("serve", form({ ...reach, areas, [TURNSTILE_FIELD]: "good-token" }), deps);
    expect(saved.map(({ kind, payload }) => ({ kind, payload }))).toEqual([
      { kind: "visit", payload: { name: "Sam Example", phone: "555-555-0123", message: "Coming Friday" } },
      { kind: "join", payload: { name: "Sam Example", phone: "555-555-0123", band: "hs" } },
      { kind: "serve", payload: { name: "Sam Example", phone: "555-555-0123", areas: ["worship", "media"] } },
    ]);
  });

  it("saves a photo takedown from the Contact form as its own kind", async () => {
    const { deps, saved } = fakes();

    expect(await handleMessage("contact", form({ ...person, reason: "takedown" }), deps)).toEqual({
      status: "sent",
      firstName: "Maya",
    });
    expect(saved[0].kind).toBe("takedown");
    expect(saved[0].payload).not.toHaveProperty("reason");
  });

  it("saves a staging message as staging, with the alert address staging was given", async () => {
    const { deps, saved } = fakes({ env: () => ({ ...READY, appEnv: "staging", alertTo: "owner@example.test" }) });

    await handleMessage("contact", form(person), deps);
    expect(saved[0]).toMatchObject({ env: "staging", alertTo: "owner@example.test" });
  });

  it("still saves, and thanks them, when there's nowhere to send an alert", async () => {
    const { deps, saved, drains } = fakes({ env: () => ({ ...READY, alertTo: null }) });

    expect(await handleMessage("contact", form(person), deps)).toEqual({ status: "sent", firstName: "Maya" });
    expect(saved[0].alertTo).toBeNull();
    expect(drains()).toBe(0);
  });

  it("sends back every problem with the fields, and saves nothing", async () => {
    const { deps, saved, verified } = fakes();

    expect(await handleMessage("contact", form({ ...person, email: "", message: "" }), deps)).toEqual({
      status: "invalid",
      errors: { email: "Add your email so we can write back.", message: "Write a message." },
    });
    expect(saved).toEqual([]);
    expect(verified).toEqual([]);
  });

  it.each([
    ["filled in the honeypot", { [HONEYPOT_FIELD]: "https://spam.example" }],
    ["sent the form too fast", { [ELAPSED_FIELD]: "400" }],
  ])("looks the same to a bot that %s, and saves nothing", async (_, trap) => {
    const { deps, saved, verified, drains } = fakes();

    expect(await handleMessage("contact", form({ ...person, ...trap }), deps)).toEqual({
      status: "sent",
      firstName: "Maya",
    });
    expect(saved).toEqual([]);
    expect(verified).toEqual([]);
    expect(drains()).toBe(0);
  });

  it("saves nothing when Turnstile fails, and says how to reach us", async () => {
    const { deps, saved } = fakes();

    expect(await handleMessage("contact", form({ ...person, [TURNSTILE_FIELD]: "bad-token" }), deps)).toEqual({
      status: "failed",
      message: failures.notChecked,
    });
    expect(failures.notChecked).toContain(site.email);
    expect(saved).toEqual([]);
  });

  it("tells someone over the hourly limit to try later, and sends no alert", async () => {
    const limited = "You've sent a few messages already. Try again in an hour.";
    const { deps, drains } = fakes({ save: async () => ({ status: "limited", message: limited }) });

    expect(await handleMessage("contact", form(person), deps)).toEqual({ status: "failed", message: limited });
    expect(drains()).toBe(0);
  });

  it("says it didn't send when saving fails, and reports it to the owners", async () => {
    const { deps, drains, reports } = fakes({
      save: async () => {
        throw new Error("Couldn't save the message: connection refused");
      },
    });

    const reply = await handleMessage("contact", form(person), deps);
    expect(reply).toEqual({ status: "failed", message: failures.notSaved });
    expect(drains()).toBe(0);
    expect(reports).toEqual([
      { source: "Contact form", message: "Couldn't save the message: connection refused" },
    ]);
  });

  it.each([
    ["Turnstile", { turnstileSecret: null }],
    ["the address salt", { ipSalt: null }],
  ])("saves nothing, points to email, and reports it when %s isn't set up", async (_, missing) => {
    const { deps, saved, verified, reports } = fakes({ env: () => ({ ...READY, ...missing }) });

    expect(await handleMessage("contact", form(person), deps)).toEqual({
      status: "failed",
      message: failures.notSetUp,
    });
    expect(failures.notSetUp).toContain(site.email);
    expect(saved).toEqual([]);
    expect(verified).toEqual([]);
    expect(reports).toEqual([
      {
        source: "Message forms",
        message: "Set TURNSTILE_SECRET_KEY and FORM_IP_SALT before the forms can save messages.",
      },
    ]);
  });

  it("saves nothing, and reports it, when a setting is wrong", async () => {
    const { deps, saved, reports } = fakes({
      env: () => {
        throw new Error("Invalid environment variables: FORM_IP_SALT must be at least 32 characters");
      },
    });

    expect(await handleMessage("contact", form(person), deps)).toEqual({
      status: "failed",
      message: failures.notSetUp,
    });
    expect(saved).toEqual([]);
    expect(reports).toEqual([
      {
        source: "Message forms",
        message: "Invalid environment variables: FORM_IP_SALT must be at least 32 characters",
      },
    ]);
  });

  it("refuses a form that doesn't exist", async () => {
    const { deps, saved } = fakes();

    expect(await handleMessage("prayer" as MessageKind, form(person), deps)).toEqual({
      status: "failed",
      message: "That form doesn't exist.",
    });
    expect(saved).toEqual([]);
  });

  it("never lets the page pick the takedown kind directly", async () => {
    const { deps, saved } = fakes();

    expect(await handleMessage("takedown" as MessageKind, form(person), deps)).toMatchObject({ status: "failed" });
    expect(saved).toEqual([]);
  });
});
