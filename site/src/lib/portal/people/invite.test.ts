import { describe, expect, it } from "vitest";
import {
  accountLinks,
  choosePayee,
  emailPattern,
  emailProblem,
  friendlyError,
  planInvite,
  type ExistingPerson,
  type PayeeRow,
} from "./invite";

const USER_ID = "7d1e1a35-5b0f-4f43-8d8e-2b1f5f0c9a01";
const OTHER_USER_ID = "7d1e1a35-5b0f-4f43-8d8e-2b1f5f0c9a02";
const PAYEE_ID = "0b6f4c1e-8a52-4d0e-9a51-3c9f0c2d7e11";

function person(overrides: Partial<ExistingPerson> = {}): ExistingPerson {
  return { id: USER_ID, full_name: "Pat Example", roles: [], is_active: true, ...overrides };
}

describe("planInvite", () => {
  it("invites someone new with the roles picked", () => {
    expect(planInvite(null, null, ["site_messages", "site_editor"])).toEqual({
      kind: "invite",
      roles: ["site_editor", "site_messages"],
      added: ["site_editor", "site_messages"],
    });
  });

  it("invites someone whose account has no access yet", () => {
    expect(planInvite(person(), null, ["site_editor"])).toMatchObject({ kind: "invite", roles: ["site_editor"] });
  });

  it("sends a pending invite again, adding the new roles to the old", () => {
    expect(planInvite(person({ roles: ["finance_requester"] }), "pending", ["site_editor"])).toEqual({
      kind: "resend",
      roles: ["finance_requester", "site_editor"],
      added: ["site_editor"],
    });
  });

  it("gives someone who already signs in more access, keeping what they had", () => {
    expect(planInvite(person({ roles: ["finance_viewer"] }), "accepted", ["site_editor"])).toEqual({
      kind: "access",
      roles: ["finance_viewer", "site_editor"],
      added: ["site_editor"],
    });
    expect(planInvite(person({ roles: ["finance_viewer"] }), null, ["site_messages"])).toMatchObject({
      kind: "access",
    });
  });

  it("emails someone with an accepted invite about new access, even with no roles left", () => {
    expect(planInvite(person({ roles: [] }), "accepted", ["site_editor"])).toMatchObject({ kind: "access" });
  });

  it("changes nothing when they already have every role picked", () => {
    expect(planInvite(person({ roles: ["site_editor", "site_messages"] }), "accepted", ["site_editor"])).toEqual({
      kind: "unchanged",
      roles: ["site_editor", "site_messages"],
      added: [],
    });
  });

  it("counts an owner as already having every role", () => {
    expect(planInvite(person({ roles: ["owner"] }), null, ["site_editor"])).toMatchObject({
      kind: "unchanged",
      roles: ["owner"],
    });
  });

  it("refuses someone whose access was removed", () => {
    expect(planInvite(person({ is_active: false, roles: ["site_editor"] }), "accepted", ["site_editor"])).toEqual({
      kind: "refuse",
      message: "Pat Example's access was removed. Reinstate them from People instead.",
    });
  });
});

describe("choosePayee", () => {
  const unlinked: PayeeRow = { id: PAYEE_ID, email: "pat@example.test", user_id: null };

  it("does nothing for someone who isn't a requester", () => {
    expect(choosePayee({ choice: null, userId: null, linked: null, picked: null, sameEmail: null })).toEqual({
      action: "none",
    });
  });

  it("keeps a payee they're already linked to", () => {
    expect(
      choosePayee({ choice: { kind: "new" }, userId: USER_ID, linked: PAYEE_ID, picked: null, sameEmail: null }),
    ).toEqual({ action: "none" });
  });

  it("makes a new payee when none has their email", () => {
    expect(choosePayee({ choice: { kind: "new" }, userId: null, linked: null, picked: null, sameEmail: null })).toEqual(
      { action: "create" },
    );
  });

  it("links the payee that already has their email instead of making another", () => {
    expect(
      choosePayee({ choice: { kind: "new" }, userId: null, linked: null, picked: null, sameEmail: unlinked }),
    ).toEqual({ action: "link", payeeId: PAYEE_ID });
  });

  it("refuses a new payee when someone else's payee has the email", () => {
    expect(
      choosePayee({
        choice: { kind: "new" },
        userId: USER_ID,
        linked: null,
        picked: null,
        sameEmail: { ...unlinked, user_id: OTHER_USER_ID },
      }),
    ).toEqual({
      action: "refuse",
      message: "Another person's payee already uses this email. Pick their payee instead, or check the email.",
    });
  });

  it("links the payee that was picked", () => {
    expect(
      choosePayee({
        choice: { kind: "existing", id: PAYEE_ID },
        userId: null,
        linked: null,
        picked: unlinked,
        sameEmail: null,
      }),
    ).toEqual({ action: "link", payeeId: PAYEE_ID });
  });

  it("refuses a picked payee that's gone or linked to someone else", () => {
    const choice = { kind: "existing", id: PAYEE_ID } as const;

    expect(choosePayee({ choice, userId: null, linked: null, picked: null, sameEmail: null })).toEqual({
      action: "refuse",
      message: "That payee isn't in finances anymore. Pick another.",
    });
    const taken = { ...unlinked, user_id: OTHER_USER_ID };
    expect(choosePayee({ choice, userId: USER_ID, linked: null, picked: taken, sameEmail: null })).toEqual({
      action: "refuse",
      message: "That payee is already linked to someone else. Pick another.",
    });
  });

  it("links a picked payee that's already theirs", () => {
    const choice = { kind: "existing", id: PAYEE_ID } as const;
    const theirs = { ...unlinked, user_id: USER_ID };

    expect(choosePayee({ choice, userId: USER_ID, linked: null, picked: theirs, sameEmail: null })).toEqual({
      action: "none",
    });
  });
});

describe("accountLinks", () => {
  const urls = { portalUrl: "https://portal.example.test", financesUrl: "https://finances.example.test" };

  it("sends requesters to finances, the only app they use", () => {
    expect(accountLinks(["finance_requester"], urls)).toEqual({
      app: "finances",
      appName: "SBC South Youth Finances",
      setupUrl: "https://finances.example.test/setup",
      signInUrl: "https://finances.example.test/login",
    });
  });

  it("sends everyone else to the portal", () => {
    expect(accountLinks(["finance_requester", "site_editor"], urls)).toEqual({
      app: "portal",
      appName: "SBC South Youth Portal",
      setupUrl: "https://portal.example.test/setup",
      signInUrl: "https://portal.example.test/login",
    });
    expect(accountLinks(["finance_viewer"], urls).app).toBe("portal");
  });
});

describe("emailPattern", () => {
  it("matches the address exactly, ignoring case", () => {
    expect(emailPattern("pat@example.test")).toBe("pat@example.test");
  });

  it("escapes the characters that would match anything", () => {
    expect(emailPattern("pat_100%@example.test")).toBe("pat\\_100\\%@example.test");
    expect(emailPattern("a\\b@example.test")).toBe("a\\\\b@example.test");
  });

  it("lets PostgREST's star match one character, since it can't be escaped", () => {
    expect(emailPattern("pat*@example.test")).toBe("pat_@example.test");
  });
});

describe("friendlyError", () => {
  const fallback = "Couldn't send the invite. Try again.";

  it("shows the database's own message for a refused change", () => {
    for (const code of ["42501", "22023", "55000", "P0002", "23505"]) {
      expect(friendlyError({ code, message: "That user is already linked to another payee." }, fallback)).toBe(
        "That user is already linked to another payee.",
      );
    }
  });

  it("hides Postgres's own wording and anything unexpected", () => {
    const rls = 'new row violates row-level security policy for table "payees"';
    const duplicate = 'duplicate key value violates unique constraint "payees_email_key"';

    expect(friendlyError({ code: "42501", message: rls }, fallback)).toBe(fallback);
    expect(friendlyError({ code: "23505", message: duplicate }, fallback)).toBe(fallback);
    expect(friendlyError({ code: "08006", message: "connection failure" }, fallback)).toBe(fallback);
    expect(friendlyError(null, fallback)).toBe(fallback);
  });
});

describe("emailProblem", () => {
  it("says nothing when the email went out, or none was needed", () => {
    expect(emailProblem("sent", "invite")).toBeNull();
    expect(emailProblem(null, "access")).toBeNull();
  });

  it("points an invite that didn't go out at sending it again", () => {
    expect(emailProblem("failed", "invite")).toBe(
      "Something went wrong sending it. Invite them again to try once more.",
    );
    expect(emailProblem("skipped_quota", "invite")).toBe(
      "Today's email limit is nearly used up, so it was held back. Invite them again tomorrow to send it.",
    );
  });

  it("asks the owner to pass on new access themselves, since there's nothing to resend", () => {
    expect(emailProblem("failed", "access")).toBe("Something went wrong sending it, so let them know yourself.");
    expect(emailProblem("off", "access")).toBe("Email isn't set up here, so let them know yourself.");
  });

  it("flags an address that bounced before either way", () => {
    expect(emailProblem("suppressed", "access")).toBe(
      "Email to this address bounced or was marked as spam before. Check the address with them.",
    );
  });
});
