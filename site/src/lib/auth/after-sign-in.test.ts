import { describe, expect, it } from "vitest";
import { nextAfterSignIn } from "./after-sign-in";

const financesUrl = "https://finances.sbcsouthyouth.com";
const shared = { sharedSignIn: true, financesUrl };
const separate = { sharedSignIn: false, financesUrl };

describe("nextAfterSignIn", () => {
  it("ends on the Where to? page when no link asked for a page", () => {
    expect(nextAfterSignIn(null, shared)).toBe("/start");
    expect(nextAfterSignIn("", separate)).toBe("/start");
  });

  it("keeps a portal page", () => {
    expect(nextAfterSignIn("/messages?view=open", shared)).toBe("/messages?view=open");
    expect(nextAfterSignIn("/people", separate)).toBe("/people");
  });

  it("goes back to finances once the two share a sign-in", () => {
    expect(nextAfterSignIn(`${financesUrl}/requests/new`, shared)).toBe(`${financesUrl}/requests/new`);
  });

  it("stays on the portal while finances has its own sign-in", () => {
    expect(nextAfterSignIn(`${financesUrl}/requests/new`, separate)).toBe("/start");
  });

  it("refuses anywhere else", () => {
    expect(nextAfterSignIn("https://evil.example/requests", shared)).toBe("/start");
  });
});
