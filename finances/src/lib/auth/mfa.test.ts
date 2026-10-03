import { describe, expect, it } from "vitest";
import {
  afterSignInPath,
  describeMfaError,
  deviceNameError,
  formatDeviceDate,
  groupKey,
  mfaHref,
  ownerNeedsMfa,
  qrCodeSrc,
  suggestDeviceName,
  verifiedDevices,
} from "./mfa";

describe("ownerNeedsMfa", () => {
  it("asks an owner who hasn't entered a code yet", () => {
    expect(ownerNeedsMfa(["owner"], "aal1")).toBe(true);
    expect(ownerNeedsMfa(["owner", "site_editor"], null)).toBe(true);
  });

  it("lets an owner through once they've entered a code", () => {
    expect(ownerNeedsMfa(["owner"], "aal2")).toBe(false);
  });

  it("never asks anyone else", () => {
    expect(ownerNeedsMfa(["site_editor"], "aal1")).toBe(false);
    expect(ownerNeedsMfa(["finance_viewer", "site_messages"], "aal1")).toBe(false);
    expect(ownerNeedsMfa([], "aal1")).toBe(false);
  });
});

describe("mfaHref", () => {
  it("keeps where to go after", () => {
    expect(mfaHref("/admin/requests?tab=paid")).toBe("/mfa?next=%2Fadmin%2Frequests%3Ftab%3Dpaid");
  });

  it("leaves out the start page", () => {
    expect(mfaHref("/")).toBe("/mfa");
  });
});

describe("afterSignInPath", () => {
  it("sends someone with a device to enter a code", () => {
    expect(afterSignInPath("/account", { currentLevel: "aal1", nextLevel: "aal2" })).toBe("/mfa?next=%2Faccount");
  });

  it("goes straight on without a device", () => {
    expect(afterSignInPath("/account", { currentLevel: "aal1", nextLevel: "aal1" })).toBe("/account");
  });

  it("goes straight on once a code was entered", () => {
    expect(afterSignInPath("/admin", { currentLevel: "aal2", nextLevel: "aal2" })).toBe("/admin");
  });

  it("goes straight on when the level is unknown", () => {
    expect(afterSignInPath("/admin", null)).toBe("/admin");
  });
});

describe("verifiedDevices", () => {
  const factor = {
    factor_type: "totp" as const,
    status: "verified" as const,
    updated_at: "2026-10-02T00:00:00Z",
  };

  it("lists verified authenticator apps, oldest first", () => {
    expect(
      verifiedDevices([
        { ...factor, id: "b", friendly_name: "Backup", created_at: "2026-10-02T12:00:00Z" },
        { ...factor, id: "a", friendly_name: "Phone", created_at: "2026-10-01T12:00:00Z" },
      ]),
    ).toEqual([
      { id: "a", name: "Phone", createdAt: "2026-10-01T12:00:00Z" },
      { id: "b", name: "Backup", createdAt: "2026-10-02T12:00:00Z" },
    ]);
  });

  it("skips unfinished setups and other kinds of factor", () => {
    expect(
      verifiedDevices([
        { ...factor, id: "a", status: "unverified", friendly_name: "Phone", created_at: "2026-10-01T12:00:00Z" },
        { ...factor, id: "b", factor_type: "phone", created_at: "2026-10-01T12:00:00Z" },
      ]),
    ).toEqual([]);
  });

  it("names a device that has no name", () => {
    expect(verifiedDevices([{ ...factor, id: "a", friendly_name: " ", created_at: "2026-10-01T12:00:00Z" }])).toEqual([
      { id: "a", name: "Authenticator app", createdAt: "2026-10-01T12:00:00Z" },
    ]);
  });
});

describe("suggestDeviceName", () => {
  it("starts with Phone, then Backup", () => {
    expect(suggestDeviceName([])).toBe("Phone");
    expect(suggestDeviceName(["Phone"])).toBe("Backup");
  });

  it("numbers devices after that", () => {
    expect(suggestDeviceName(["Phone", "Backup"])).toBe("Device 3");
    expect(suggestDeviceName(["Phone", "Backup", "Device 3"])).toBe("Device 4");
  });

  it("never suggests a name already in use", () => {
    expect(suggestDeviceName(["phone"])).toBe("Backup");
    expect(suggestDeviceName(["iPad"])).toBe("Phone");
    expect(suggestDeviceName(["Phone", "Backup", "Device 4"])).toBe("Device 3");
    expect(suggestDeviceName(["Phone", "Backup", "Device 3", "Device 4"])).toBe("Device 5");
  });
});

describe("deviceNameError", () => {
  it("accepts a new name", () => {
    expect(deviceNameError("iPad", ["Phone"])).toBeUndefined();
  });

  it("needs a name", () => {
    expect(deviceNameError("  ", [])).toBe("Name this device.");
  });

  it("keeps names short", () => {
    expect(deviceNameError("x".repeat(40), [])).toBeUndefined();
    expect(deviceNameError("x".repeat(41), [])).toBe("Use 40 characters or fewer.");
  });

  it("rejects a name already in use, ignoring case and spaces", () => {
    expect(deviceNameError(" phone ", ["Phone"])).toBe("You already have a device called Phone.");
  });
});

describe("groupKey", () => {
  it("splits the key into groups of four for typing", () => {
    expect(groupKey("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567")).toBe("ABCD EFGH IJKL MNOP QRST UVWX YZ23 4567");
    expect(groupKey("ABCDEF")).toBe("ABCD EF");
  });
});

describe("qrCodeSrc", () => {
  it("turns Supabase's SVG into an image URL", () => {
    expect(qrCodeSrc('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1"/></svg>')).toBe(
      "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%200h1%22%2F%3E%3C%2Fsvg%3E",
    );
  });

  it("encodes the image URL Supabase sends, so characters like # survive", () => {
    expect(qrCodeSrc('data:image/svg+xml;utf-8,<svg fill="#000"></svg>')).toBe(
      "data:image/svg+xml;charset=utf-8,%3Csvg%20fill%3D%22%23000%22%3E%3C%2Fsvg%3E",
    );
  });

  it("keeps any other image URL as it is", () => {
    expect(qrCodeSrc("data:image/png;base64,iVBORw0KGgo=")).toBe("data:image/png;base64,iVBORw0KGgo=");
  });
});

describe("formatDeviceDate", () => {
  it("shows the day it was added, in Pacific time", () => {
    expect(formatDeviceDate("2026-10-02T05:00:00Z")).toBe("Oct 1, 2026");
    expect(formatDeviceDate("2026-10-02T18:00:00Z")).toBe("Oct 2, 2026");
  });
});

describe("describeMfaError", () => {
  const fallback = "Couldn't check the code. Try again.";

  it("points at the code when it's wrong", () => {
    expect(describeMfaError({ status: 422, code: "mfa_verification_failed" }, fallback)).toEqual({
      field: true,
      message: "That code didn't work. Enter the newest code from your authenticator app.",
    });
  });

  it("points at the code when it took too long", () => {
    expect(describeMfaError({ status: 422, code: "mfa_challenge_expired" }, fallback)).toEqual({
      field: true,
      message: "That took too long. Enter the newest code from your authenticator app.",
    });
  });

  it("points at the name when it's taken", () => {
    expect(describeMfaError({ status: 422, code: "mfa_factor_name_conflict" }, fallback)).toEqual({
      field: true,
      message: "You already have a device with that name.",
    });
  });

  it("says when there have been too many tries", () => {
    expect(describeMfaError({ status: 429, code: "over_request_rate_limit" }, fallback)).toEqual({
      field: false,
      message: "Too many attempts. Wait a few minutes, then try again.",
    });
  });

  it("blames the connection when the server can't be reached", () => {
    expect(describeMfaError({}, fallback)).toEqual({
      field: false,
      message: "Couldn't reach the server. Check your connection and try again.",
    });
    expect(describeMfaError({ status: 503 }, fallback).message).toBe(
      "Couldn't reach the server. Check your connection and try again.",
    );
  });

  it("says when two-step sign-in is turned off", () => {
    expect(describeMfaError({ status: 422, code: "mfa_totp_enroll_not_enabled" }, fallback)).toEqual({
      field: false,
      message: "Two-step sign-in isn't turned on yet. Ask the site maintainer to turn it on.",
    });
    expect(describeMfaError({ status: 422, code: "mfa_totp_verify_not_enabled" }, fallback).field).toBe(false);
  });

  it("asks for a code first when the session isn't verified", () => {
    expect(describeMfaError({ status: 403, code: "insufficient_aal" }, fallback)).toEqual({
      field: false,
      message: "Enter a code from one of your devices first, then try again.",
    });
  });

  it("falls back to the action's own message", () => {
    expect(describeMfaError({ status: 400, code: "unexpected_failure" }, fallback)).toEqual({
      field: false,
      message: fallback,
    });
  });
});
