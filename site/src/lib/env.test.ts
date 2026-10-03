import { describe, expect, it } from "vitest";
import { assertWritable, readPortalEnv, readServerEnv, ReadOnlyError } from "./env";

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

describe("readPortalEnv", () => {
  it("treats a build with nothing set as production, with the real finances address", () => {
    expect(readPortalEnv({})).toEqual({ appEnv: "production", financesUrl: "https://finances.sbcsouthyouth.com" });
  });

  it("treats a Vercel preview as staging when APP_ENV is unset, so a forgotten variable stays safe", () => {
    expect(readPortalEnv({ VERCEL_ENV: "preview" }).appEnv).toBe("staging");
    expect(readPortalEnv({ VERCEL_ENV: "production" }).appEnv).toBe("production");
    expect(readPortalEnv({ VERCEL_ENV: "development" }).appEnv).toBe("production");
  });

  it("lets APP_ENV say which it is", () => {
    expect(readPortalEnv({ APP_ENV: "staging", VERCEL_ENV: "production" }).appEnv).toBe("staging");
    expect(readPortalEnv({ APP_ENV: " production ", VERCEL_ENV: "preview" }).appEnv).toBe("production");
    expect(readPortalEnv({ APP_ENV: "", VERCEL_ENV: "preview" }).appEnv).toBe("staging");
  });

  it.each(["prod", "Staging", "dev"])("rejects APP_ENV %j by name", (value) => {
    expect(() => readPortalEnv({ APP_ENV: value })).toThrow(/APP_ENV/);
  });

  it("reads the finances address without a trailing slash", () => {
    expect(readPortalEnv({ FINANCES_URL: "http://localhost:3000/" }).financesUrl).toBe("http://localhost:3000");
    expect(readPortalEnv({ FINANCES_URL: " " }).financesUrl).toBe("https://finances.sbcsouthyouth.com");
  });

  it.each(["finances.example.test", "javascript:alert(1)", "ftp://example.test"])(
    "rejects the finances address %j by name",
    (value) => {
      expect(() => readPortalEnv({ FINANCES_URL: value })).toThrow(/FINANCES_URL/);
    },
  );
});

describe("assertWritable", () => {
  it("lets production write", () => {
    expect(() => assertWritable({})).not.toThrow();
    expect(() => assertWritable({ APP_ENV: "production" })).not.toThrow();
  });

  it("refuses to write on staging, which shares production's data", () => {
    expect(() => assertWritable({ APP_ENV: "staging" })).toThrow(ReadOnlyError);
    expect(() => assertWritable({ VERCEL_ENV: "preview" })).toThrow(/staging/i);
  });
});
