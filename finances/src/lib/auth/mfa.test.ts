import { describe, expect, it } from "vitest";
import { describeMfaError, verifiedDevices } from "./mfa";

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
