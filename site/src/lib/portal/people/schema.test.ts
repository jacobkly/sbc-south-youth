import { describe, expect, it } from "vitest";
import { checkInvite, INVITE_ROLES } from "./schema";

const PAYEE_ID = "0b6f4c1e-8a52-4d0e-9a51-3c9f0c2d7e11";

const valid = {
  fullName: "Pat Example",
  email: "pat@example.test",
  roles: ["site_editor"],
  adult: true,
  payee: "",
};

describe("checkInvite", () => {
  it("accepts a name, an email, a role, and the 18+ box", () => {
    expect(checkInvite(valid)).toEqual({
      ok: true,
      invite: { fullName: "Pat Example", email: "pat@example.test", roles: ["site_editor"], payee: null },
    });
  });

  it("trims the name and lowercases the email", () => {
    const result = checkInvite({ ...valid, fullName: "  Pat   Example ", email: " Pat@Example.TEST " });

    expect(result.ok && result.invite.fullName).toBe("Pat Example");
    expect(result.ok && result.invite.email).toBe("pat@example.test");
  });

  it("lists roles once each, in the portal's order", () => {
    const result = checkInvite({ ...valid, roles: ["site_messages", "finance_viewer", "site_messages"] });

    expect(result.ok && result.invite.roles).toEqual(["finance_viewer", "site_messages"]);
  });

  it("needs a name", () => {
    expect(checkInvite({ ...valid, fullName: "  " })).toEqual({ ok: false, errors: { fullName: "Enter their name." } });
  });

  it("keeps the name to 100 characters", () => {
    const result = checkInvite({ ...valid, fullName: "A".repeat(101) });

    expect(result).toEqual({ ok: false, errors: { fullName: "Keep the name to 100 characters or fewer." } });
  });

  it("needs an email", () => {
    expect(checkInvite({ ...valid, email: " " })).toEqual({
      ok: false,
      errors: { email: "Enter their email address." },
    });
  });

  it.each(["pat", "pat@", "pat example@example.test", `${"a".repeat(250)}@example.test`])(
    "refuses the email %j",
    (email) => {
      expect(checkInvite({ ...valid, email })).toEqual({
        ok: false,
        errors: { email: "Enter a whole email address, like name@example.com." },
      });
    },
  );

  it("needs at least one role", () => {
    expect(checkInvite({ ...valid, roles: [] })).toEqual({ ok: false, errors: { roles: "Choose at least one role." } });
  });

  it("leaves Owner off the invite", () => {
    expect(INVITE_ROLES).not.toContain("owner");
    expect(checkInvite({ ...valid, roles: ["owner"] })).toEqual({
      ok: false,
      errors: { roles: "Choose at least one role." },
    });
  });

  it("refuses a role that doesn't exist", () => {
    expect(checkInvite({ ...valid, roles: ["site_editor", "admin"] })).toEqual({
      ok: false,
      errors: { roles: "Choose at least one role." },
    });
  });

  it("needs the 18+ box", () => {
    expect(checkInvite({ ...valid, adult: false })).toEqual({
      ok: false,
      errors: { adult: "Only adults get an account. Check this to confirm they're 18 or older." },
    });
  });

  it("reports every problem at once", () => {
    const result = checkInvite({ fullName: "", email: "", roles: [], adult: false, payee: "" });

    expect(result.ok ? [] : Object.keys(result.errors).sort()).toEqual(["adult", "email", "fullName", "roles"]);
  });

  it("refuses something that isn't a form at all", () => {
    expect(checkInvite(null)).toEqual({
      ok: false,
      errors: {
        fullName: "Enter their name.",
        email: "Enter their email address.",
        roles: "Choose at least one role.",
        adult: "Only adults get an account. Check this to confirm they're 18 or older.",
      },
    });
  });

  describe("a requester's payee", () => {
    const requester = { ...valid, roles: ["finance_requester"] };

    it("makes a new payee unless one is picked", () => {
      expect(checkInvite({ ...requester, payee: "" })).toMatchObject({ ok: true, invite: { payee: { kind: "new" } } });
      expect(checkInvite({ ...requester, payee: "new" })).toMatchObject({
        ok: true,
        invite: { payee: { kind: "new" } },
      });
    });

    it("links the payee that was picked", () => {
      expect(checkInvite({ ...requester, payee: PAYEE_ID })).toMatchObject({
        ok: true,
        invite: { payee: { kind: "existing", id: PAYEE_ID } },
      });
    });

    it("refuses a payee that isn't an ID", () => {
      expect(checkInvite({ ...requester, payee: "Pat" })).toEqual({ ok: false, errors: { payee: "Pick a payee." } });
    });

    it("reports a payee that wasn't picked alongside other problems", () => {
      const result = checkInvite({ ...requester, adult: false, payee: "none" });

      expect(result).toEqual({
        ok: false,
        errors: { adult: expect.any(String), payee: "Pick a payee." },
      });
    });

    it("ignores the payee for anyone who isn't a requester", () => {
      expect(checkInvite({ ...valid, payee: PAYEE_ID })).toMatchObject({ ok: true, invite: { payee: null } });
    });
  });
});
