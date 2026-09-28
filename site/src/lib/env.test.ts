import { describe, expect, it } from "vitest";
import { readServerEnv } from "./env";

describe("readServerEnv", () => {
  it("allows every variable to be missing", () => {
    expect(readServerEnv({})).toEqual({ giveCashtag: null, textNumber: null });
  });

  it("reads the church text number in any common US format", () => {
    expect(readServerEnv({ CHURCH_TEXT_NUMBER: "+15555550123" }).textNumber).toBe("+15555550123");
    expect(readServerEnv({ CHURCH_TEXT_NUMBER: "(555) 555-0123" }).textNumber).toBe("+15555550123");
    expect(readServerEnv({ CHURCH_TEXT_NUMBER: "1 555 555 0123" }).textNumber).toBe("+15555550123");
    expect(readServerEnv({ CHURCH_TEXT_NUMBER: " " }).textNumber).toBeNull();
  });

  it.each(["555-0123", "+44 20 7946 0958", "call me"])("rejects the text number %j by name", (value) => {
    expect(() => readServerEnv({ CHURCH_TEXT_NUMBER: value })).toThrow(/CHURCH_TEXT_NUMBER/);
  });

  it("reads the giving cashtag", () => {
    expect(readServerEnv({ GIVE_CASHTAG: "$ExampleYouth" }).giveCashtag).toBe("$ExampleYouth");
    expect(readServerEnv({ GIVE_CASHTAG: "  $ExampleYouth " }).giveCashtag).toBe("$ExampleYouth");
  });

  it("treats a blank cashtag as missing", () => {
    expect(readServerEnv({ GIVE_CASHTAG: " " }).giveCashtag).toBeNull();
  });

  it.each(["ExampleYouth", "$", "$has space", "$waaaaaaaaaaaaaaaaaaaytoolong"])(
    "rejects the cashtag %j by name",
    (value) => {
      expect(() => readServerEnv({ GIVE_CASHTAG: value })).toThrow(/GIVE_CASHTAG/);
    },
  );
});
