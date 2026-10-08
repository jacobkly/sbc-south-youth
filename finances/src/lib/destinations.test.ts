import { describe, expect, it } from "vitest";
import { destinationsFor } from "./destinations";

const urls = {
  portalUrl: "https://portal.example.test",
  siteUrl: "https://example.test",
};

describe("destinationsFor", () => {
  it("gives an owner both apps and the public site, with finances linking home", () => {
    expect(destinationsFor({ is_active: true, roles: ["owner"] }, urls)).toEqual([
      {
        key: "portal",
        name: "Portal",
        description: "Posts, photos, messages, attendance, activity, people, and email",
        href: "https://portal.example.test",
      },
      { key: "finances", name: "Finances", description: "Requests, payees, and reports", href: "/" },
      { key: "site", name: "Main site", description: "example.test, as visitors see it", href: "https://example.test" },
    ]);
  });

  it("describes the portal by the sections this person sees there", () => {
    const [viewer] = destinationsFor({ is_active: true, roles: ["finance_viewer"] }, urls);
    expect(viewer).toMatchObject({ key: "portal", description: "Attendance and activity" });
    const [both] = destinationsFor({ is_active: true, roles: ["finance_requester", "site_editor"] }, urls);
    expect(both).toMatchObject({ key: "portal", description: "Posts, photos, and activity" });
  });

  it("opens the portal for Attendance alone", () => {
    const destinations = destinationsFor({ is_active: true, roles: ["attendance"] }, urls);
    expect(destinations.map((d) => d.key)).toEqual(["portal", "site"]);
    expect(destinations[0].description).toBe("Attendance");
  });

  it("gives a requester only finances and the public site", () => {
    const destinations = destinationsFor({ is_active: true, roles: ["finance_requester"] }, urls);
    expect(destinations.map((d) => d.key)).toEqual(["finances", "site"]);
    expect(destinations[0].description).toBe("Your reimbursement requests");
  });

  it("gives removed access only the public site", () => {
    expect(destinationsFor({ is_active: false, roles: ["owner"] }, urls).map((d) => d.key)).toEqual(["site"]);
  });
});
