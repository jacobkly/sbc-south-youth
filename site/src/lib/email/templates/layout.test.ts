import { createElement as h } from "react";
import { describe, expect, it } from "vitest";
import { renderEmail } from "../render";
import { EmailButton, EmailFacts, EmailHeading, EmailLayout, EmailNote, EmailQuote, EmailText } from "./layout";

function sample(name: string) {
  return h(
    EmailLayout,
    { preview: "Set up your account in a minute.", reason: "You're getting this because an owner invited you." },
    h(EmailHeading, null, `Welcome, ${name}`),
    h(EmailText, null, "You've been invited to the leader portal."),
    h(EmailButton, { href: "https://portal.example.test/setup?code=1" }, "Set up your account"),
    h(EmailNote, null, "The link works for 24 hours."),
  );
}

describe("the email layout", () => {
  it("renders a whole email document", async () => {
    const { html } = await renderEmail(sample("Alex"));

    expect(html).toMatch(/^<!DOCTYPE html/);
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('<meta name="color-scheme" content="light dark"');
    expect(html).toContain("Welcome, Alex");
    expect(html).toContain('href="https://portal.example.test/setup?code=1"');
    expect(html).toContain("You&#x27;re getting this because an owner invited you.");
  });

  it("hides the preview line from the body but keeps it first", async () => {
    const { html } = await renderEmail(sample("Alex"));
    const body = html.slice(html.indexOf("<body"));

    expect(body.indexOf("Set up your account in a minute.")).toBeLessThan(body.indexOf("Welcome, Alex"));
    expect(body).toMatch(/<div[^>]*display:none[^>]*>Set up your account in a minute\./);
  });

  it("escapes text, so a name can't add markup", async () => {
    const { html } = await renderEmail(sample('<img src=x onerror="alert(1)">'));

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });

  it("has a plain-text version with the link and no markup", async () => {
    const { text } = await renderEmail(sample("Alex"));

    expect(text).toContain("Welcome, Alex");
    expect(text).toContain("https://portal.example.test/setup?code=1");
    expect(text).toContain("You're getting this because an owner invited you.");
    expect(text).not.toMatch(/<[a-z]/i);
    expect(text).not.toContain("Set up your account in a minute.");
  });

  it("puts each fact on its own line in plain text, label first", async () => {
    const { text } = await renderEmail(
      h(
        EmailLayout,
        { preview: "A request is waiting.", reason: "You're an owner." },
        h(EmailFacts, {
          facts: [
            ["Amount", "$45.50"],
            ["Store", "Fake Store"],
          ],
        }),
      ),
    );

    expect(text).toMatch(/^Amount +\$45\.50$/m);
    expect(text).toMatch(/^Store +Fake Store$/m);
  });

  it("keeps a quote's line breaks", async () => {
    const { html, text } = await renderEmail(
      h(EmailLayout, { preview: "A question.", reason: "You asked." }, h(EmailQuote, null, "Which event?\nAnd when?")),
    );

    expect(html).toMatch(/Which event\?(<!-- -->)?<\/span><span><br\/?>(<!-- -->)?And when\?/);
    expect(text).toMatch(/^> Which event\?\n> And when\?$/m);
  });
});
