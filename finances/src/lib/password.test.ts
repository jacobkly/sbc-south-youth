import { describe, expect, it } from "vitest";
import { cleanCode, CODE_LENGTH, MIN_PASSWORD_LENGTH, newPasswordErrors } from "./password";

describe("newPasswordErrors", () => {
  it("accepts a long enough password typed twice", () => {
    const password = "correct horse battery";
    expect(newPasswordErrors({ password, confirm: password })).toEqual({});
  });

  it("asks for at least 12 characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
    expect(newPasswordErrors({ password: "", confirm: "" })).toEqual({ password: "Use at least 12 characters." });
    expect(newPasswordErrors({ password: "a".repeat(11), confirm: "a".repeat(11) })).toEqual({
      password: "Use at least 12 characters.",
    });
    expect(newPasswordErrors({ password: "a".repeat(12), confirm: "a".repeat(12) })).toEqual({});
  });

  it("refuses more than Supabase can store", () => {
    // bcrypt reads only the first 72 bytes, so Supabase refuses longer passwords.
    expect(newPasswordErrors({ password: "a".repeat(72), confirm: "a".repeat(72) })).toEqual({});
    expect(newPasswordErrors({ password: "a".repeat(73), confirm: "a".repeat(73) })).toEqual({
      password: "That's too long. Try a shorter one.",
    });
    // 19 emoji are 76 bytes.
    const emoji = "🔒".repeat(19);
    expect(newPasswordErrors({ password: emoji, confirm: emoji }).password).toBeDefined();
  });

  it("checks the two match only once the password itself is fine", () => {
    expect(newPasswordErrors({ password: "correct horse battery", confirm: "correct horse" })).toEqual({
      confirm: "The passwords don't match.",
    });
    expect(newPasswordErrors({ password: "short", confirm: "other" })).toEqual({
      password: "Use at least 12 characters.",
    });
  });
});

describe("cleanCode", () => {
  it("keeps only the digits", () => {
    expect(CODE_LENGTH).toBe(6);
    expect(cleanCode("123456")).toBe("123456");
    expect(cleanCode(" 123 456 ")).toBe("123456");
    expect(cleanCode("123-456")).toBe("123456");
  });

  it("stops at six digits, so a pasted code with extra text still fits", () => {
    expect(cleanCode("Your code is 123456.")).toBe("123456");
    expect(cleanCode("1234567")).toBe("123456");
  });
});
