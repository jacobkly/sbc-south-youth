import { describe, expect, it } from "vitest";
import { sendToLocalInbox } from "./local-inbox";

const email = {
  from: "Example Youth <hello@mail.example.test>",
  to: "pat@example.test",
  subject: "Set up your account",
  html: "<p>Hi</p>",
  text: "Hi",
  tags: [
    { name: "log_id", value: "0b6f4c1e-8a52-4d0e-9a51-3c9f0c2d7e11" },
    { name: "template", value: "invite" },
  ],
};

function fakeFetch(response: Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response;
  };
  return { calls, fetcher };
}

describe("sendToLocalInbox", () => {
  it("posts the email to Mailpit's send API", async () => {
    const { calls, fetcher } = fakeFetch(Response.json({ ID: "mailpit-1" }));

    const result = await sendToLocalInbox("http://127.0.0.1:54324", email, fetcher);

    expect(result).toEqual({ id: "mailpit-1" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://127.0.0.1:54324/api/v1/send");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      From: { Email: "hello@mail.example.test", Name: "Example Youth" },
      To: [{ Email: "pat@example.test" }],
      Subject: "Set up your account",
      HTML: "<p>Hi</p>",
      Text: "Hi",
      Tags: ["invite"],
    });
  });

  it("sets Reply-To when the email has one", async () => {
    const { calls, fetcher } = fakeFetch(Response.json({ ID: "mailpit-3" }));

    await sendToLocalInbox("http://127.0.0.1:54324", { ...email, replyTo: "maya@example.test" }, fetcher);

    expect(JSON.parse(String(calls[0].init.body)).ReplyTo).toEqual([{ Email: "maya@example.test" }]);
  });

  it("takes a bare sender address", async () => {
    const { calls, fetcher } = fakeFetch(Response.json({ ID: "mailpit-2" }));

    await sendToLocalInbox("http://localhost:54324", { ...email, from: "hello@mail.example.test" }, fetcher);

    expect(JSON.parse(String(calls[0].init.body)).From).toEqual({ Email: "hello@mail.example.test" });
  });

  it("reports what Mailpit said when it refuses", async () => {
    const { fetcher } = fakeFetch(new Response("invalid To address", { status: 400 }));

    expect(await sendToLocalInbox("http://127.0.0.1:54324", email, fetcher)).toEqual({
      error: "The local inbox answered 400: invalid To address",
    });
  });

  it("reports an answer without an ID", async () => {
    const { fetcher } = fakeFetch(Response.json({}));

    expect(await sendToLocalInbox("http://127.0.0.1:54324", email, fetcher)).toEqual({
      error: "The local inbox didn't return an ID",
    });
  });
});
