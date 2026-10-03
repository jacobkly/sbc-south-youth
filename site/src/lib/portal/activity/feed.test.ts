import { describe, expect, it } from "vitest";
import {
  activityCsv,
  buildActivityDays,
  dayLabel,
  eventChanges,
  eventTitle,
  groupActivity,
  itemTitle,
  toFeedRow,
  type FeedContext,
  type FeedRow,
} from "./feed";

const ME = "00000000-0000-4000-8000-000000000001";
const OWNER = "00000000-0000-4000-8000-000000000002";
const EDITOR = "00000000-0000-4000-8000-000000000003";
const REQUEST = "00000000-0000-4000-8000-0000000000a1";
const REQUEST_2 = "00000000-0000-4000-8000-0000000000b2";
const REQUEST_3 = "00000000-0000-4000-8000-0000000000b3";
const INVITE = "00000000-0000-4000-8000-0000000000c1";
const PAYEE = "00000000-0000-4000-8000-0000000000d1";
const GONE = "00000000-0000-4000-8000-0000000000e1";

let nextId = 0;

/** A feed row with what every row has filled in. */
function row(fields: Partial<FeedRow> & Pick<FeedRow, "action" | "created_at">): FeedRow {
  nextId += 1;
  const entityType = fields.action.startsWith("request.") ? "request" : fields.action.split(".")[0];
  return {
    id: `row-${nextId}`,
    scope: fields.action.startsWith("request.") ? "finances" : "platform",
    actor_id: OWNER,
    entity_type: entityType,
    entity_id: null,
    entity_name: null,
    changes: null,
    note: null,
    from_status: null,
    to_status: null,
    ...fields,
  };
}

function context(overrides: Partial<FeedContext> = {}): FeedContext {
  return {
    meId: ME,
    names: new Map([
      [ME, "Test Me"],
      [OWNER, "Test Owner"],
      [EDITOR, "Test Editor"],
    ]),
    requests: new Map([
      [
        REQUEST,
        {
          id: REQUEST,
          request_number: 12,
          type: "youth",
          amount_cents: 1200,
          vendor: "Test Market",
          description: null,
          payee_name: "Test Payee",
        },
      ],
    ]),
    payeeNames: new Map([[PAYEE, "Test Payee"]]),
    inviteUsers: new Map([[INVITE, EDITOR]]),
    financesUrl: "https://finances.example.test",
    canOpenPeople: true,
    today: "2026-10-02",
    ...overrides,
  };
}

describe("toFeedRow", () => {
  it("keeps rows with what the feed needs and drops the rest", () => {
    const raw = {
      id: "x",
      created_at: "2026-10-02T17:00:00Z",
      scope: "platform",
      actor_id: null,
      action: "auth.signed_in",
      entity_type: "user",
      entity_id: EDITOR,
      entity_name: "Test Editor",
      changes: null,
      note: null,
      from_status: null,
      to_status: null,
    };
    expect(toFeedRow(raw)?.action).toBe("auth.signed_in");
    expect(toFeedRow({ ...raw, id: null })).toBeNull();
    expect(toFeedRow({ ...raw, scope: "elsewhere" })).toBeNull();
  });
});

describe("eventTitle", () => {
  it("words finance events the way finances does", () => {
    const at = "2026-10-02T17:00:00Z";
    expect(eventTitle(row({ action: "request.recorded_paid", created_at: at }))).toBe("Recorded as paid");
    expect(eventTitle(row({ action: "request.submitted", from_status: "needs_info", created_at: at }))).toBe(
      "Resubmitted",
    );
  });

  it("says what happened to someone's access", () => {
    const at = "2026-10-02T17:00:00Z";
    const access = (from: boolean, to: boolean) => ({ is_active: { from, to } });
    expect(eventTitle(row({ action: "user.updated", changes: access(true, false), created_at: at }))).toBe(
      "Access removed",
    );
    expect(eventTitle(row({ action: "user.updated", changes: access(false, true), created_at: at }))).toBe(
      "Access restored",
    );
    const roles = { roles: { from: ["site_editor"], to: ["site_editor", "site_messages"] } };
    expect(eventTitle(row({ action: "user.updated", changes: roles, created_at: at }))).toBe("Roles changed");
    expect(eventTitle(row({ action: "user.created", created_at: at }))).toBe("Account created");
    expect(eventTitle(row({ action: "user.deleted", created_at: at }))).toBe("Account deleted");
  });

  it("follows an invite from sent to accepted", () => {
    const at = "2026-10-02T17:00:00Z";
    expect(eventTitle(row({ action: "invite.created", created_at: at }))).toBe("Invited");
    const resent = { sent_count: { from: 1, to: 2 } };
    expect(eventTitle(row({ action: "invite.updated", changes: resent, created_at: at }))).toBe("Invite resent");
    const accepted = { status: { from: "pending", to: "accepted" } };
    expect(eventTitle(row({ action: "invite.updated", changes: accepted, created_at: at }))).toBe("Invite accepted");
  });

  it("names sign-ins and downloads", () => {
    const at = "2026-10-02T17:00:00Z";
    expect(eventTitle(row({ action: "auth.signed_in", created_at: at }))).toBe("Signed in");
    expect(eventTitle(row({ action: "export.downloaded", created_at: at }))).toBe("Report downloaded");
    expect(eventTitle(row({ action: "activity.exported", created_at: at }))).toBe("Activity downloaded");
  });

  it("still reads for things the portal will log later", () => {
    const at = "2026-10-02T17:00:00Z";
    expect(eventTitle(row({ action: "post.created", created_at: at }))).toBe("Post added");
    expect(eventTitle(row({ action: "event.updated", created_at: at }))).toBe("Event changed");
    expect(eventTitle(row({ action: "photo.deleted", created_at: at }))).toBe("Photo removed");
    expect(eventTitle(row({ action: "mystery", created_at: at }))).toBe("mystery");
  });
});

describe("eventChanges", () => {
  const at = "2026-10-02T17:00:00Z";

  it("shows roles by name, in the usual order", () => {
    const changes = { roles: { from: ["site_messages"], to: ["site_messages", "finance_viewer"] } };
    expect(eventChanges(row({ action: "user.updated", changes, created_at: at }))).toEqual([
      { label: "Roles", from: "Messages", to: "Finance viewer, Messages" },
    ]);
    const none = { roles: { from: [], to: ["owner"] } };
    expect(eventChanges(row({ action: "user.updated", changes: none, created_at: at }))).toEqual([
      { label: "Roles", from: "None", to: "Owner" },
    ]);
  });

  it("shows access, invite status, and times sent", () => {
    const changes = { is_active: { from: true, to: false } };
    expect(eventChanges(row({ action: "user.updated", changes, created_at: at }))).toEqual([
      { label: "Access", from: "Active", to: "Removed" },
    ]);
    const invite = { status: { from: "pending", to: "accepted" }, sent_count: { from: 1, to: 2 } };
    expect(eventChanges(row({ action: "invite.updated", changes: invite, created_at: at }))).toEqual([
      { label: "Invite", from: "Pending", to: "Accepted" },
      { label: "Times sent", from: "1", to: "2" },
    ]);
  });

  it("shows only what a new row starts with, leaving out the usual starting values", () => {
    const account = { roles: { from: null, to: [] }, is_active: { from: null, to: true } };
    expect(eventChanges(row({ action: "user.created", changes: account, created_at: at }))).toEqual([]);
    const invite = {
      roles: { from: null, to: ["site_editor"] },
      status: { from: null, to: "pending" },
      sent_count: { from: null, to: 1 },
    };
    expect(eventChanges(row({ action: "invite.created", changes: invite, created_at: at }))).toEqual([
      { label: "Roles", from: null, to: "Site editor" },
    ]);
  });

  it("shows only what a deleted row had", () => {
    const changes = { roles: { from: ["owner"], to: null }, is_active: { from: true, to: null } };
    expect(eventChanges(row({ action: "user.deleted", changes, created_at: at }))).toEqual([
      { label: "Roles", from: "Owner", to: null },
    ]);
  });

  it("uses finances' wording for request edits, with payee names", () => {
    const changes = { payee_id: { from: null, to: PAYEE }, amount_cents: { from: 1000, to: 1200 } };
    const payeeNames = new Map([[PAYEE, "Test Payee"]]);
    expect(eventChanges(row({ action: "request.updated", changes, created_at: at }), payeeNames)).toEqual([
      { label: "Payee", from: "None", to: "Test Payee" },
      { label: "Amount", from: "$10.00", to: "$12.00" },
    ]);
  });
});

describe("groupActivity", () => {
  it("shows inviting someone as one item, though it makes three rows", () => {
    const at = "2026-10-02T17:00:00.000Z";
    const rows = [
      row({ action: "invite.created", entity_id: INVITE, entity_name: "Test Editor", created_at: at }),
      row({
        action: "user.updated",
        entity_id: EDITOR,
        changes: { roles: { from: [], to: ["site_editor"] } },
        created_at: at,
      }),
      row({ action: "user.created", entity_id: EDITOR, actor_id: null, created_at: at }),
    ];
    const items = groupActivity(rows, new Map([[INVITE, EDITOR]]));
    expect(items).toHaveLength(1);
    expect(items[0].events.map((event) => event.action)).toEqual(["user.created", "user.updated", "invite.created"]);
    expect(itemTitle(items[0])).toBe("Invited");
  });

  it("joins one person's quick changes to a request, like finances", () => {
    const rows = [
      row({ action: "request.receipt_added", entity_id: REQUEST, created_at: "2026-10-02T17:03:00.000Z" }),
      row({ action: "request.receipt_added", entity_id: REQUEST, created_at: "2026-10-02T17:02:00.000Z" }),
      row({ action: "request.created", entity_id: REQUEST, created_at: "2026-10-02T17:01:00.000Z" }),
    ];
    const items = groupActivity(rows, new Map());
    expect(items).toHaveLength(1);
    expect(itemTitle(items[0])).toBe("Created, 2 files added");
  });

  it("keeps different people, and changes far apart, separate", () => {
    const rows = [
      row({ action: "request.updated", entity_id: REQUEST, actor_id: EDITOR, created_at: "2026-10-02T17:20:00Z" }),
      row({ action: "request.updated", entity_id: REQUEST, created_at: "2026-10-02T17:19:00.000Z" }),
      row({ action: "request.created", entity_id: REQUEST, created_at: "2026-10-02T17:00:00.000Z" }),
    ];
    expect(groupActivity(rows, new Map())).toHaveLength(3);
  });

  it("shows an import as one item", () => {
    const at = "2026-10-02T17:00:00.000Z";
    const rows = [REQUEST, REQUEST_2, REQUEST_3].flatMap((id) => [
      row({ action: "request.recorded_paid", entity_id: id, created_at: at }),
      row({ action: "request.created", entity_id: id, created_at: at }),
    ]);
    const items = groupActivity(rows, new Map());
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("bulk");
    expect(itemTitle(items[0])).toBe("Imported 3 paid requests");
  });
});

describe("buildActivityDays", () => {
  it("describes a request by number, payee, amount, and vendor, and links to it in finances", () => {
    const rows = [row({ action: "request.approved", entity_id: REQUEST, created_at: "2026-10-02T17:00:00.000Z" })];
    const [day] = buildActivityDays(rows, context());
    expect(day.label).toBe("Today");
    const [entry] = day.entries;
    expect(entry).toMatchObject({
      title: "Approved",
      subject: "R-0012 · Test Payee · $12.00 · Test Market",
      byline: "by Test Owner",
      actor: "Test Owner",
      scope: "finances",
      icon: "approved",
      link: { href: `https://finances.example.test/admin/requests/${REQUEST}`, label: "Open in Finances" },
    });
    expect(entry.time).toBe("10:00 AM");
  });

  it("says when a request can't be found", () => {
    const rows = [row({ action: "request.approved", entity_id: REQUEST_2, created_at: "2026-10-02T17:00:00.000Z" })];
    const [entry] = buildActivityDays(rows, context())[0].entries;
    expect(entry.subject).toBe("A request that's gone");
    expect(entry.link).toBeNull();
  });

  it("leaves the byline off for your own changes and someone's own sign-in", () => {
    const rows = [
      row({ action: "request.approved", entity_id: REQUEST, actor_id: ME, created_at: "2026-10-02T18:00:00.000Z" }),
      row({
        action: "auth.signed_in",
        entity_type: "user",
        entity_id: EDITOR,
        entity_name: "Test Editor",
        actor_id: EDITOR,
        created_at: "2026-10-02T17:00:00.000Z",
      }),
    ];
    const [mine, signIn] = buildActivityDays(rows, context())[0].entries;
    expect(mine.byline).toBeNull();
    expect(mine.actor).toBe("You");
    expect(signIn).toMatchObject({ title: "Signed in", subject: "Test Editor", byline: null });
  });

  it("links people for owners only, and names someone since deleted by their old name", () => {
    const at = "2026-10-02T17:00:00.000Z";
    const rows = [
      row({ action: "user.updated", entity_id: EDITOR, entity_name: "Old Name", created_at: at }),
      row({ action: "user.deleted", entity_id: GONE, entity_name: "Gone Person", created_at: at }),
    ];
    const [updated, deleted] = buildActivityDays(rows, context())[0].entries;
    const link = { href: `/people/${EDITOR}`, label: "Open person" };
    expect(updated).toMatchObject({ subject: "Test Editor", link });
    expect(deleted).toMatchObject({ subject: "Gone Person", link: null });

    const viewer = buildActivityDays(rows, context({ canOpenPeople: false }))[0].entries;
    expect(viewer[0].link).toBeNull();
  });

  it("has no finances link without a finances address", () => {
    const rows = [row({ action: "request.approved", entity_id: REQUEST, created_at: "2026-10-02T17:00:00.000Z" })];
    expect(buildActivityDays(rows, context({ financesUrl: null }))[0].entries[0].link).toBeNull();
  });

  it("lists an import's requests", () => {
    const at = "2026-10-02T17:00:00.000Z";
    const rows = [REQUEST, REQUEST_2, REQUEST_3].map((id) =>
      row({ action: "request.created", entity_id: id, created_at: at }),
    );
    const [entry] = buildActivityDays(rows, context())[0].entries;
    expect(entry.title).toBe("Created 3 requests at once");
    expect(entry.icon).toBe("bulk");
    expect(entry.related).toHaveLength(3);
    expect(entry.related[0]).toEqual({
      label: "R-0012 · Test Payee · $12.00 · Test Market",
      href: `https://finances.example.test/admin/requests/${REQUEST}`,
    });
  });

  it("puts each event's changes, file, and note in the details", () => {
    const rows = [
      row({
        action: "request.info_requested",
        entity_id: REQUEST,
        note: "Which event?",
        created_at: "2026-10-02T17:02:00Z",
      }),
      row({
        action: "request.receipt_added",
        entity_id: REQUEST,
        changes: { receipt_id: "x", filename: "Test receipt.jpg" },
        created_at: "2026-10-02T17:01:00.000Z",
      }),
    ];
    const [entry] = buildActivityDays(rows, context())[0].entries;
    expect(entry.title).toBe("File added, asked for more info");
    expect(entry.events).toMatchObject([
      { title: "File added", filename: "Test receipt.jpg", note: null },
      { title: "Asked for more info", filename: null, note: "Which event?" },
    ]);
  });

  it("splits the feed by Los Angeles day", () => {
    const rows = [
      row({ action: "auth.signed_in", entity_id: EDITOR, actor_id: EDITOR, created_at: "2026-10-02T17:00:00.000Z" }),
      // 11 PM on Oct 1 in Los Angeles, though it's already Oct 2 in UTC.
      row({ action: "auth.signed_in", entity_id: EDITOR, actor_id: EDITOR, created_at: "2026-10-02T06:00:00.000Z" }),
    ];
    expect(buildActivityDays(rows, context()).map((day) => day.label)).toEqual(["Today", "Yesterday"]);
  });
});

describe("dayLabel", () => {
  it("says today and yesterday, then the date", () => {
    expect(dayLabel("2026-10-02", "2026-10-02")).toBe("Today");
    expect(dayLabel("2026-10-01", "2026-10-02")).toBe("Yesterday");
    expect(dayLabel("2026-09-25", "2026-10-02")).toBe("Fri, Sep 25");
  });
});

describe("activityCsv", () => {
  it("writes one line per event, newest first, with readable changes", () => {
    const rows = [
      row({
        action: "user.updated",
        entity_id: EDITOR,
        changes: { roles: { from: [], to: ["site_editor"] }, is_active: { from: false, to: true } },
        created_at: "2026-10-02T17:00:00.000Z",
      }),
      row({
        action: "request.info_requested",
        entity_id: REQUEST,
        note: "Which event?",
        created_at: "2026-10-01T17:00:00Z",
      }),
    ];
    const csv = activityCsv(rows, context());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Date,Time,App,Who,What,About,Changes,Note");
    expect(lines[1]).toBe(
      "2026-10-02,10:00 AM,People,Test Owner,Access restored,Test Editor," +
        "Roles: None → Site editor; Access: Removed → Active,",
    );
    expect(lines[2]).toBe(
      "2026-10-01,10:00 AM,Finances,Test Owner,Asked for more info," +
        "R-0012 · Test Payee · $12.00 · Test Market,,Which event?",
    );
  });

  it("marks what a new or deleted row had", () => {
    const deleted = { roles: { from: ["owner"], to: null } };
    const invited = { roles: { from: null, to: ["site_editor"] } };
    const rows = [
      row({ action: "user.deleted", entity_id: EDITOR, changes: deleted, created_at: "2026-10-02T17:00:00Z" }),
      row({ action: "invite.created", entity_id: INVITE, changes: invited, created_at: "2026-10-02T16:00:00Z" }),
    ];
    const lines = activityCsv(rows, context()).split("\r\n");
    expect(lines[1]).toContain(",Roles: was Owner,");
    expect(lines[2]).toContain(",Roles: Site editor,");
  });
});
