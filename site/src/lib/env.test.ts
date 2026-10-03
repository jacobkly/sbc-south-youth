import { describe, expect, it } from "vitest";
import { assertWritable, readEmailEnv, readPortalEnv, readServerEnv, ReadOnlyError } from "./env";

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
    expect(readPortalEnv({})).toEqual({
      appEnv: "production",
      financesUrl: "https://finances.sbcsouthyouth.com",
      portalUrl: "https://portal.sbcsouthyouth.com",
    });
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

  it("reads the portal's own address, for links in emails", () => {
    expect(readPortalEnv({ PORTAL_URL: "http://portal.localhost:3001/" }).portalUrl).toBe(
      "http://portal.localhost:3001",
    );
    expect(readPortalEnv({ PORTAL_URL: "" }).portalUrl).toBe("https://portal.sbcsouthyouth.com");
    expect(() => readPortalEnv({ PORTAL_URL: "portal.example.test" })).toThrow(/PORTAL_URL/);
  });
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

describe("readEmailEnv", () => {
  const ready = {
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "Example Youth <hello@mail.example.test>",
  };

  it("turns email off when nothing is set", () => {
    expect(readEmailEnv({})).toEqual({
      appEnv: "production",
      sending: null,
      ownerAlertEmail: null,
      webhookSecret: null,
      drainSecret: null,
    });
  });

  it("sends once the API key and sender are both set", () => {
    expect(readEmailEnv(ready).sending).toEqual({
      apiKey: "re_test_key",
      from: "Example Youth <hello@mail.example.test>",
    });
    expect(readEmailEnv({ ...ready, EMAIL_FROM: " " }).sending).toBeNull();
    expect(readEmailEnv({ ...ready, RESEND_API_KEY: "" }).sending).toBeNull();
  });

  it("takes a bare sender address too", () => {
    const bare = readEmailEnv({ ...ready, EMAIL_FROM: "hello@mail.example.test" });
    expect(bare.sending?.from).toBe("hello@mail.example.test");
  });

  it("delivers to a local inbox instead, when one is set", () => {
    const local = { EMAIL_FROM: ready.EMAIL_FROM, EMAIL_LOCAL_INBOX: "http://127.0.0.1:54324/" };

    expect(readEmailEnv(local).sending).toEqual({
      localInbox: "http://127.0.0.1:54324",
      from: "Example Youth <hello@mail.example.test>",
    });
    expect(readEmailEnv({ ...ready, ...local }).sending).toEqual(readEmailEnv(local).sending);
    expect(readEmailEnv({ EMAIL_LOCAL_INBOX: "http://localhost:54324" }).sending).toBeNull();
  });

  it.each(["http://localhost:8025", "http://[::1]:8025", "http://127.0.0.1"])(
    "takes the local inbox %j",
    (value) => {
      expect(readEmailEnv({ ...ready, EMAIL_LOCAL_INBOX: value }).sending).toMatchObject({ localInbox: value });
    },
  );

  it.each(["https://mail.example.test", "http://10.0.0.5:8025", "ftp://localhost", "http://localhost.example.test"])(
    "refuses a local inbox %j that isn't on this computer",
    (value) => {
      expect(() => readEmailEnv({ ...ready, EMAIL_LOCAL_INBOX: value })).toThrow(/EMAIL_LOCAL_INBOX/);
    },
  );

  it("follows APP_ENV like the portal does", () => {
    expect(readEmailEnv({ VERCEL_ENV: "preview" }).appEnv).toBe("staging");
    expect(readEmailEnv({ APP_ENV: "production", VERCEL_ENV: "preview" }).appEnv).toBe("production");
  });

  it("reads the owner alert address in lowercase", () => {
    expect(readEmailEnv({ OWNER_ALERT_EMAIL: " Owner@Example.test " }).ownerAlertEmail).toBe("owner@example.test");
  });

  it("reads the webhook secret", () => {
    expect(readEmailEnv({ RESEND_WEBHOOK_SECRET: "whsec_c2VjcmV0" }).webhookSecret).toBe("whsec_c2VjcmV0");
  });

  it("reads the drain secret", () => {
    expect(readEmailEnv({ EMAIL_DRAIN_SECRET: " a-long-test-secret " }).drainSecret).toBe("a-long-test-secret");
    expect(readEmailEnv({ EMAIL_DRAIN_SECRET: "" }).drainSecret).toBeNull();
  });

  it.each([
    ["RESEND_API_KEY", "sk_live_123"],
    ["EMAIL_FROM", "Example Youth"],
    ["EMAIL_FROM", "Example <not an address>"],
    ["EMAIL_FROM", "Example <hello@mail.example.test>\r\nBcc: someone@example.test"],
    ["OWNER_ALERT_EMAIL", "owner"],
    ["RESEND_WEBHOOK_SECRET", "c2VjcmV0"],
    ["EMAIL_DRAIN_SECRET", "too-short"],
  ])("rejects %s %j by name", (name, value) => {
    expect(() => readEmailEnv({ ...ready, [name]: value })).toThrow(new RegExp(name));
  });
});
