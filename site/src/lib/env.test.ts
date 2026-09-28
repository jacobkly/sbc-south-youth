import { describe, expect, it } from "vitest";
import { readServerEnv } from "./env";

describe("readServerEnv", () => {
  it("allows every variable to be missing", () => {
    expect(readServerEnv({})).toEqual({ giveCashtag: null });
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
