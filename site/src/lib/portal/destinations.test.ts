import { describe, expect, it } from "vitest";
import { destinationsFor, onlyApp } from "./destinations";

const urls = {
  portalUrl: "https://portal.example.test",
  financesUrl: "https://finances.example.test",
  siteUrl: "https://example.test",
};

describe("destinationsFor", () => {
  it("gives an owner both apps and the public site", () => {
    expect(destinationsFor({ is_active: true, roles: ["owner"] }, urls)).toEqual([
      {
        key: "portal",
        name: "Portal",
        description: "Posts, photos, attendance, messages, email, people, and activity",
        href: "https://portal.example.test",
      },
      {
        key: "finances",
        name: "Finances",
        description: "Requests, payees, and reports",
        href: "https://finances.example.test",
      },
      { key: "site", name: "Main site", description: "example.test, as visitors see it", href: "https://example.test" },
    ]);
  });

  it("describes the portal by the sections this person sees", () => {
    const [portal] = destinationsFor({ is_active: true, roles: ["site_editor"] }, urls);
    expect(portal.description).toBe("Posts, photos, and activity");
    const [messages] = destinationsFor({ is_active: true, roles: ["site_messages"] }, urls);
    expect(messages.description).toBe("Messages and activity");
  });

  it("gives a requester finances and the public site", () => {
    expect(destinationsFor({ is_active: true, roles: ["finance_requester"] }, urls).map((d) => d.key)).toEqual([
      "finances",
      "site",
    ]);
    const [finances] = destinationsFor({ is_active: true, roles: ["finance_requester"] }, urls);
    expect(finances.description).toBe("Your reimbursement requests");
  });

  it("links the app someone is in to its own home", () => {
    const hrefs = destinationsFor({ is_active: true, roles: ["owner"] }, urls, "finances").map((d) => d.href);
    expect(hrefs).toEqual(["https://portal.example.test", "/", "https://example.test"]);
  });

  it("gives removed access only the public site", () => {
    expect(destinationsFor({ is_active: false, roles: ["owner"] }, urls).map((d) => d.key)).toEqual(["site"]);
  });
});

describe("onlyApp", () => {
  it("skips to the one app someone signs in to", () => {
    expect(onlyApp(destinationsFor({ is_active: true, roles: ["finance_requester"] }, urls))?.key).toBe("finances");
    expect(onlyApp(destinationsFor({ is_active: true, roles: ["site_editor"] }, urls))?.key).toBe("portal");
  });

  it("asks when there are two, and has nowhere to go with none", () => {
    expect(onlyApp(destinationsFor({ is_active: true, roles: ["owner"] }, urls))).toBeNull();
    expect(onlyApp(destinationsFor({ is_active: true, roles: [] }, urls))).toBeNull();
  });
});
