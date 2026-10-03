import { describe, expect, it } from "vitest";
import { listPeople, type PeopleUser } from "./list";

function user(overrides: Partial<PeopleUser>): PeopleUser {
  return {
    id: "u-1",
    full_name: "Pat Example",
    email: "pat@example.test",
    avatar_path: null,
    roles: ["site_editor"],
    is_active: true,
    ...overrides,
  };
}

describe("listPeople", () => {
  it("shows someone with roles and no pending invite as active", () => {
    const [person] = listPeople([user({})], [], "me");

    expect(person.status).toBe("active");
  });

  it("shows someone whose invite is still pending as invited", () => {
    const [person] = listPeople([user({})], [{ user_id: "u-1", status: "pending" }], "me");

    expect(person.status).toBe("invited");
  });

  it("shows an accepted invite as active", () => {
    const [person] = listPeople([user({})], [{ user_id: "u-1", status: "accepted" }], "me");

    expect(person.status).toBe("active");
  });

  it("shows removed access over a pending invite", () => {
    const people = listPeople([user({ is_active: false })], [{ user_id: "u-1", status: "pending" }], "me");

    expect(people[0].status).toBe("removed");
  });

  it("shows an account with no roles as no access", () => {
    const [person] = listPeople([user({ roles: [] })], [], "me");

    expect(person.status).toBe("no_access");
  });

  it("lists an owner's roles as Owner alone, since it covers the rest", () => {
    const [person] = listPeople([user({ roles: ["site_messages", "owner", "finance_viewer"] })], [], "me");

    expect(person.roles).toEqual(["owner"]);
  });

  it("lists other roles in the app's order", () => {
    const [person] = listPeople([user({ roles: ["site_messages", "finance_requester", "site_editor"] })], [], "me");

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
    );

    expect(people.map((person) => person.name)).toEqual(["Alex Test", "sam Placeholder", "Casey Sample"]);
  });

  it("marks the signed-in owner as you", () => {
    const people = listPeople([user({ id: "me" }), user({ id: "u-2", full_name: "Sam Placeholder" })], [], "me");

    expect(people.find((person) => person.id === "me")?.you).toBe(true);
    expect(people.find((person) => person.id === "u-2")?.you).toBe(false);
  });

  it("shows a blank name as the email", () => {
    const [person] = listPeople([user({ full_name: "  " })], [], "me");

    expect(person.name).toBe("pat@example.test");
  });
});
