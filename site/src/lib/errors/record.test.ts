import { describe, expect, it } from "vitest";
import { errorRecord, isControlFlow, routeSource } from "./record";

describe("errorRecord", () => {
  it("keeps an error's message and never its stack", () => {
    const error = new Error("The photos couldn't load");
    const record = errorRecord("Photos", error);

    expect(record).toEqual({ source: "Photos", message: "The photos couldn't load", code: null });
    expect(JSON.stringify(record)).not.toContain("at ");
  });

  it("reads a database error's message and code", () => {
    const error = { message: "permission denied for table photos", code: "42501", details: null, hint: null };

    expect(errorRecord("Save a photo", error)).toEqual({
      source: "Save a photo",
      message: "permission denied for table photos",
      code: "42501",
    });
  });

  it("adds what caused it, like the connection a fetch couldn't make", () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:54321"), { code: "ECONNREFUSED" });
    const error = new TypeError("fetch failed", { cause });

    expect(errorRecord("Email drain", error)).toEqual({
      source: "Email drain",
      message: "fetch failed (connect ECONNREFUSED 127.0.0.1:54321)",
      code: "ECONNREFUSED",
    });
  });

  it("keeps the digest React leaves on a page error, to match the host's logs", () => {
    const error = Object.assign(new Error("An error occurred in the Server Components render."), {
      digest: "2417336940",
    });

    expect(errorRecord("Portal page /", error).code).toBe("2417336940");
  });

  it("reads a thrown string", () => {
    expect(errorRecord("Proxy", "Something broke").message).toBe("Something broke");
  });

  it.each([null, undefined, {}, { message: 42 }])("says there was no message when %j has none", (value) => {
    expect(errorRecord("Proxy", value).message).toBe("No error message");
  });

  it("hides email addresses", () => {
    const error = { message: "Key (email)=(sam.rivera+test@example.test) already exists.", code: "23505" };

    expect(errorRecord("Invite", error).message).toBe("Key (email)=([email]) already exists.");
  });

  it.each(["555-123-4567", "(555) 123-4567", "+1 555.123.4567", "5551234567"])("hides the phone number %s", (phone) => {
    expect(errorRecord("Contact form", new Error(`Couldn't save ${phone} for now`)).message).toBe(
      "Couldn't save [phone] for now",
    );
  });

  it("leaves IDs, times, and ports alone", () => {
    const message =
      "Request 123e4567-e89b-12d3-a456-426614174000 at 2026-10-03T12:00:00Z took 1759500000000 ms on :54321";

    expect(errorRecord("Drain", new Error(message)).message).toBe(message);
  });

  it("puts it on one line", () => {
    expect(errorRecord("Drain", new Error("  first line\n\n  second\tline  ")).message).toBe("first line second line");
  });

  it("cuts a long message at 500 characters", () => {
    const message = errorRecord("Drain", new Error("x".repeat(800))).message;

    expect(message).toHaveLength(500);
    expect(message.endsWith("…")).toBe(true);
  });

  it("cuts a long source at 200 characters and names a blank one", () => {
    expect(errorRecord("y".repeat(300), new Error("Broke")).source).toHaveLength(200);
    expect(errorRecord("   ", new Error("Broke")).source).toBe("Unknown");
  });

  it("drops a code too long to be one", () => {
    expect(errorRecord("Drain", { message: "Broke", code: "c".repeat(40) }).code).toBeNull();
  });
});

describe("isControlFlow", () => {
  it.each([
    "NEXT_REDIRECT;replace;/login;307;",
    "NEXT_HTTP_ERROR_FALLBACK;404",
    "NEXT_NOT_FOUND",
    "DYNAMIC_SERVER_USAGE",
    "BAILOUT_TO_CLIENT_SIDE_RENDERING",
  ])("skips Next's own %s, which isn't an error", (digest) => {
    expect(isControlFlow(Object.assign(new Error(digest), { digest }))).toBe(true);
  });

  it("reports everything else", () => {
    expect(isControlFlow(new Error("Broke"))).toBe(false);
    expect(isControlFlow(Object.assign(new Error("Hidden"), { digest: "2417336940" }))).toBe(false);
    expect(isControlFlow("NEXT_REDIRECT")).toBe(false);
    expect(isControlFlow(null)).toBe(false);
  });
});

describe("routeSource", () => {
  it.each([
    ["/(portal)/portal/(app)/page", "render", "Portal page /"],
    ["/(portal)/portal/(app)/events/[id]/page", "render", "Portal page /events/[id]"],
    ["/(portal)/portal/(app)/photos/page", "action", "Portal action /photos"],
    ["/(portal)/portal/api/email/drain/route", "route", "Portal route /api/email/drain"],
    ["/(public)/(site)/page", "render", "Site page /"],
    ["/(public)/(site)/events/[slug]/page", "render", "Site page /events/[slug]"],
    ["/(public)/(site)/events/[slug]/calendar.ics/route", "route", "Site route /events/[slug]/calendar.ics"],
    ["/app/blog/[dynamic]", "render", "Site page /blog/[dynamic]"],
    ["/proxy", "proxy", "Proxy"],
  ] as const)("names %s (%s) as %s", (routePath, routeType, source) => {
    expect(routeSource(routePath, routeType)).toBe(source);
  });
});
