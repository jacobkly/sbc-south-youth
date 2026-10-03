import { describe, expect, it } from "vitest";
import type { AppRole } from "@/lib/portal/roles";
import { listPeople, personStatus, searchPeople, type PeopleInvite, type PeopleUser } from "./list";

function user(overrides: Partial<PeopleUser>): PeopleUser {
  return {
    id: "u-1",
    full_name: "Pat Example",
    email: "pat@example.test",
    avatar_path: null,
    roles: ["site_editor"],
    is_active: true,
    last_seen_at: null,
    ...overrides,
  };
}

function invite(overrides: Partial<PeopleInvite>): PeopleInvite {
  return { user_id: "u-1", status: "pending", last_sent_at: "2026-09-30T20:00:00Z", ...overrides };
}

// 10 AM on Friday, Oct 2, 2026 in Los Angeles.
const NOW = new Date("2026-10-02T17:00:00Z");

describe("listPeople", () => {
  it("shows someone with roles and no pending invite as active", () => {
    const [person] = listPeople([user({})], [], "me", NOW);

    expect(person.status).toBe("active");
  });

  it("shows someone whose invite is still pending as invited", () => {
    const [person] = listPeople([user({})], [invite({})], "me", NOW);

    expect(person.status).toBe("invited");
  });

  it("shows an accepted invite as active", () => {
    const [person] = listPeople([user({})], [invite({ status: "accepted" })], "me", NOW);

    expect(person.status).toBe("active");
  });

  it("shows removed access over a pending invite", () => {
    const people = listPeople([user({ is_active: false })], [invite({})], "me", NOW);

    expect(people[0].status).toBe("removed");
  });

  it("shows an account with no roles as no access", () => {
    const [person] = listPeople([user({ roles: [] })], [], "me", NOW);

    expect(person.status).toBe("no_access");
  });

  it("lists an owner's roles as Owner alone, since it covers the rest", () => {
    const [person] = listPeople([user({ roles: ["site_messages", "owner", "finance_viewer"] })], [], "me", NOW);

    expect(person.roles).toEqual(["owner"]);
  });

  it("lists other roles in the app's order", () => {
    const roles: AppRole[] = ["site_messages", "finance_requester", "site_editor"];
    const [person] = listPeople([user({ roles })], [], "me", NOW);

    expect(person.roles).toEqual(["finance_requester", "site_editor", "site_messages"]);
  });

  it("sorts by name and puts removed people last", () => {
    const people = listPeople(
      [
        user({ id: "a", full_name: "Casey Sample", is_active: false }),
        user({ id: "b", full_name: "sam Placeholder" }),
        user({ id: "c", full_name: "Alex Test" }),
      ],
      [],
      "me",
      NOW,
    );

    expect(people.map((person) => person.name)).toEqual(["Alex Test", "sam Placeholder", "Casey Sample"]);
  });

  it("marks the signed-in owner as you", () => {
    const people = listPeople([user({ id: "me" }), user({ id: "u-2", full_name: "Sam Placeholder" })], [], "me", NOW);

    expect(people.find((person) => person.id === "me")?.you).toBe(true);
    expect(people.find((person) => person.id === "u-2")?.you).toBe(false);
  });

  it("shows a blank name as the email", () => {
    const [person] = listPeople([user({ full_name: "  " })], [], "me", NOW);

    expect(person.name).toBe("pat@example.test");
  });

  it("says when someone was last seen", () => {
    const [person] = listPeople([user({ last_seen_at: "2026-10-01T18:00:00Z" })], [], "me", NOW);

    expect(person.seen).toBe("Seen yesterday");
  });

  it("says when a pending invite went out instead", () => {
    const [person] = listPeople([user({})], [invite({ last_sent_at: "2026-09-30T20:00:00Z" })], "me", NOW);

    expect(person.seen).toBe("Invite sent 2 days ago");
  });
});

describe("personStatus", () => {
  it("puts a removed person first, whatever their invite says", () => {
    expect(personStatus(false, ["site_editor"], "pending")).toBe("removed");
  });

  it("calls a pending invite invited, and an account with no roles no access", () => {
    expect(personStatus(true, ["site_editor"], "pending")).toBe("invited");
    expect(personStatus(true, [], null)).toBe("no_access");
    expect(personStatus(true, ["owner"], "accepted")).toBe("active");
  });
});

describe("searchPeople", () => {
  const people = listPeople(
    [
      user({ id: "a", full_name: "Pat Example", email: "pat@example.test", roles: ["finance_requester"] }),
      user({ id: "b", full_name: "Sam Placeholder", email: "sam@sample.test", roles: ["site_messages"] }),
      user({ id: "c", full_name: "Zoë Test", email: "zoe@example.test", roles: ["owner"], is_active: false }),
    ],
    [],
    "me",
    NOW,
  );
  const names = (query: string) => searchPeople(people, query).map((person) => person.name);

  it("keeps everyone for an empty search", () => {
    expect(names("  ")).toEqual(["Pat Example", "Sam Placeholder", "Zoë Test"]);
  });

  it("matches part of a name or email, ignoring case and accents", () => {
    expect(names("PLACE")).toEqual(["Sam Placeholder"]);
    expect(names("zoe")).toEqual(["Zoë Test"]);
    expect(names("sample.test")).toEqual(["Sam Placeholder"]);
  });

  it("matches a role or a status", () => {
    expect(names("requester")).toEqual(["Pat Example"]);
    expect(names("removed")).toEqual(["Zoë Test"]);
  });

  it("needs every word to match", () => {
    expect(names("example pat")).toEqual(["Pat Example"]);
    expect(names("pat messages")).toEqual([]);
  });
});
