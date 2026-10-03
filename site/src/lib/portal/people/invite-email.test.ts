import { describe, expect, it } from "vitest";
import { renderEmail } from "@/lib/email/render";
import { inviteEmail } from "./invite-email";

const portal = {
  app: "portal",
  appName: "SBC South Youth Portal",
  setupUrl: "https://portal.example.test/setup",
  signInUrl: "https://portal.example.test/login",
} as const;

const finances = {
  app: "finances",
  appName: "SBC South Youth Finances",
  setupUrl: "https://finances.example.test/setup",
  signInUrl: "https://finances.example.test/login",
} as const;

const invite = {
  kind: "invite",
  fullName: "Pat Example",
  email: "pat@example.test",
  inviterName: "Sam Owner",
  roles: ["site_editor", "site_messages"],
  links: portal,
} as const;

describe("the invite email", () => {
  it("names the app in the subject", () => {
    expect(inviteEmail(invite).subject).toBe("Set up your SBC South Youth Portal account");
    expect(inviteEmail({ ...invite, links: finances }).subject).toBe("Set up your SBC South Youth Finances account");
  });

  it("welcomes them by first name and says who invited them", async () => {
    const { text } = await renderEmail(inviteEmail(invite).body);

    expect(text).toContain("Welcome, Pat");
    expect(text).toContain("Sam invited you to SBC South Youth Portal.");
  });

  it("lists what each role lets them do", async () => {
    const { text } = await renderEmail(inviteEmail(invite).body);

    expect(text).toContain("Site editor");
    expect(text).toContain("Post heads-ups and events, and upload, place, and take down photos.");
    expect(text).toContain("Messages");
    expect(text).toContain("Read and handle Visit, Join, Serve, and Contact messages.");
    expect(text).not.toContain("Finance viewer");
  });

  it("links to setup without putting their address in the link", async () => {
    const { html, text } = await renderEmail(inviteEmail(invite).body);

    expect(html).toContain('href="https://portal.example.test/setup"');
    expect(html).not.toMatch(/href="[^"]*(pat|%40|\?)/);
    expect(text).toContain("pat@example.test");
    expect(text).toContain("6-digit code");
    expect(text).toMatch(/doesn.t expire/);
  });

  it("sends a requester to finances", async () => {
    const { html } = await renderEmail(inviteEmail({ ...invite, roles: ["finance_requester"], links: finances }).body);

    expect(html).toContain('href="https://finances.example.test/setup"');
  });

  it("escapes names, so they can't add markup", async () => {
    const { html } = await renderEmail(inviteEmail({ ...invite, fullName: '<b onclick="x()">Pat</b>' }).body);

    expect(html).not.toContain("<b onclick");
  });
});

describe("the new access email", () => {
  const access = { ...invite, kind: "access", roles: ["finance_viewer"] } as const;

  it("says what changed in the subject", () => {
    expect(inviteEmail(access).subject).toBe("You have new access in SBC South Youth Portal");
  });

  it("lists the new roles and links to sign in", async () => {
    const { html, text } = await renderEmail(inviteEmail(access).body);

    expect(text).toContain("Hi Pat");
    expect(text).toContain("Sam gave you new access in SBC South Youth Portal.");
    expect(text).toContain("Finance viewer");
    expect(html).toContain('href="https://portal.example.test/login"');
    expect(text).toContain("Forgot password?");
    expect(text).not.toContain("6-digit code");
    expect(text).not.toContain("authenticator app");
  });

  it("tells a new owner about two-step sign-in", async () => {
    const { text } = await renderEmail(inviteEmail({ ...access, roles: ["owner"] }).body);

    expect(text).toContain("Owner");
    expect(text).toContain("Owners also enter a code from an authenticator app when they sign in.");
    expect(text).toContain("You'll set one up the next time you open the portal.");
  });
});
