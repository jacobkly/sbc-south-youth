import { describe, expect, it } from "vitest";
import { inviteLabel, lastSeenLabel, personControls, planRoles, relativeDay, type PersonState } from "./person";

// 10 AM on Friday, Oct 2, 2026 in Los Angeles.
const NOW = new Date("2026-10-02T17:00:00Z");

describe("relativeDay", () => {
  it("says today for earlier the same day in Los Angeles", () => {
    expect(relativeDay("2026-10-02T07:30:00Z", NOW)).toBe("today");
  });

  it("says yesterday for the evening before, even when it's already the 2nd in UTC", () => {
    expect(relativeDay("2026-10-02T05:00:00Z", NOW)).toBe("yesterday");
  });

  it("counts days for the rest of the week", () => {
    expect(relativeDay("2026-09-29T20:00:00Z", NOW)).toBe("3 days ago");
    expect(relativeDay("2026-09-26T20:00:00Z", NOW)).toBe("6 days ago");
  });

  it("gives the date after a week, leaving out this year", () => {
    expect(relativeDay("2026-09-25T20:00:00Z", NOW)).toBe("Sep 25");
  });

  it("adds the year for another year", () => {
    expect(relativeDay("2025-12-30T20:00:00Z", NOW)).toBe("Dec 30, 2025");
  });

  it("treats a time a little in the future as today", () => {
    expect(relativeDay("2026-10-02T17:05:00Z", NOW)).toBe("today");
  });
});

describe("lastSeenLabel", () => {
  it("says so when they've never signed in", () => {
    expect(lastSeenLabel(null, NOW)).toBe("Hasn't signed in yet");
  });

  it("says the last hour, since a visit is only recorded once an hour", () => {
    expect(lastSeenLabel("2026-10-02T16:10:00Z", NOW)).toBe("Seen in the last hour");
  });

  it("names the day after that", () => {
    expect(lastSeenLabel("2026-10-02T15:00:00Z", NOW)).toBe("Seen today");
    expect(lastSeenLabel("2026-10-01T15:00:00Z", NOW)).toBe("Seen yesterday");
    expect(lastSeenLabel("2026-09-01T15:00:00Z", NOW)).toBe("Seen Sep 1");
  });
});

describe("inviteLabel", () => {
  it("says when a pending invite went out", () => {
    const invite = { status: "pending", sentCount: 1, lastSentAt: "2026-10-01T15:00:00Z", acceptedAt: null } as const;

    expect(inviteLabel(invite, NOW)).toBe("Sent yesterday, not accepted yet");
  });

  it("counts the sends once it has gone more than once", () => {
    const invite = { status: "pending", sentCount: 3, lastSentAt: "2026-10-02T15:00:00Z", acceptedAt: null } as const;

    expect(inviteLabel(invite, NOW)).toBe("Sent 3 times, last today, not accepted yet");
  });

  it("says when they set up their account", () => {
    const invite = {
      status: "accepted",
      sentCount: 1,
      lastSentAt: "2026-09-01T15:00:00Z",
      acceptedAt: "2026-09-02T15:00:00Z",
    } as const;

    expect(inviteLabel(invite, NOW)).toBe("Accepted Sep 2");
  });
});

const ME = "me";

function person(overrides: Partial<PersonState> = {}): PersonState {
  return { id: "u-1", roles: ["site_editor"], isActive: true, invite: "accepted", ...overrides };
}

describe("personControls", () => {
  it("lets an owner change someone's roles and remove them", () => {
    expect(personControls(person(), ME, 1)).toEqual({
      you: false,
      editRoles: true,
      ownerLock: null,
      resend: false,
      remove: true,
      reinstate: false,
    });
  });

  it("offers a resend while the invite is pending", () => {
    expect(personControls(person({ invite: "pending" }), ME, 1).resend).toBe(true);
  });

  it("waits for someone to set up their account before they can be an owner", () => {
    expect(personControls(person({ invite: "pending" }), ME, 1).ownerLock).toBe(
      "They can be made an owner once they've set up their account.",
    );
  });

  it("lets an account with no invite, like the first owner's, be an owner", () => {
    expect(personControls(person({ invite: null }), ME, 1).ownerLock).toBeNull();
  });

  it("only offers reinstating once their access is removed, and freezes their roles", () => {
    expect(personControls(person({ isActive: false, invite: "pending" }), ME, 1)).toEqual({
      you: false,
      editRoles: false,
      ownerLock: null,
      resend: false,
      remove: false,
      reinstate: true,
    });
  });

  it("never offers to remove your own access", () => {
    const controls = personControls(person({ id: ME, roles: ["owner"] }), ME, 2);

    expect(controls.you).toBe(true);
    expect(controls.remove).toBe(false);
  });

  it("locks Owner for the last active owner", () => {
    expect(personControls(person({ id: ME, roles: ["owner"] }), ME, 1).ownerLock).toBe(
      "You're the only owner. Make someone else an owner before you give it up.",
    );
  });

  it("lets an owner give up Owner while another owner is active", () => {
    expect(personControls(person({ id: ME, roles: ["owner"] }), ME, 2).ownerLock).toBeNull();
  });
});

describe("planRoles", () => {
  const input = (picked: unknown, overrides: Partial<PersonState> = {}, activeOwners = 1) => ({
    person: person(overrides),
    meId: ME,
    activeOwners,
    picked,
  });

  it("adds and takes away roles, in the portal's order", () => {
    expect(planRoles(input(["site_messages", "finance_viewer"]))).toEqual({
      kind: "change",
      roles: ["finance_viewer", "site_messages"],
      added: ["finance_viewer", "site_messages"],
      removed: ["site_editor"],
      owner: null,
    });
  });

  it("does nothing when the roles are the same", () => {
    expect(planRoles(input(["site_editor", "site_editor"]))).toEqual({ kind: "unchanged" });
  });

  it("needs at least one role, pointing to Remove access instead", () => {
    expect(planRoles(input([]))).toEqual({
      kind: "invalid",
      message: "Choose at least one role. To take away all their access, use Remove access.",
    });
  });

  it("refuses a role that doesn't exist", () => {
    expect(planRoles(input(["site_editor", "admin"]))).toMatchObject({ kind: "invalid" });
    expect(planRoles(input("owner"))).toMatchObject({ kind: "invalid" });
  });

  it("marks making someone an owner", () => {
    expect(planRoles(input(["owner", "site_editor"]))).toMatchObject({ kind: "change", owner: "grant" });
  });

  it("marks taking Owner away, and keeps the roles they had under it", () => {
    expect(planRoles(input(["site_editor"], { roles: ["owner", "site_editor"] }, 2))).toEqual({
      kind: "change",
      roles: ["site_editor"],
      added: [],
      removed: ["owner"],
      owner: "revoke",
    });
  });

  it("refuses Owner for someone who hasn't set up their account", () => {
    expect(planRoles(input(["owner"], { invite: "pending" }))).toEqual({
      kind: "invalid",
      message: "They can be made an owner once they've set up their account.",
    });
  });

  it("refuses taking Owner from the last owner", () => {
    expect(planRoles(input(["site_editor"], { id: ME, roles: ["owner", "site_editor"] }, 1))).toEqual({
      kind: "invalid",
      message: "You're the only owner. Make someone else an owner before you give it up.",
    });
  });

  it("still lets the last owner change their other roles", () => {
    expect(planRoles(input(["owner", "site_messages"], { id: ME, roles: ["owner"] }, 1))).toMatchObject({
      kind: "change",
      owner: null,
      added: ["site_messages"],
    });
  });

  it("refuses changes while their access is removed", () => {
    expect(planRoles(input(["site_messages"], { isActive: false }))).toEqual({
      kind: "invalid",
      message: "Reinstate them before changing their roles.",
    });
  });
});
