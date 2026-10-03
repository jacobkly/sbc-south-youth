import "server-only";

/**
 * Delivers an email to Mailpit, the inbox in the local Supabase stack, so
 * invites can be tested end to end without Resend. readEmailEnv() only
 * allows an address on this computer.
 */

type LocalEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  tags: { name: string; value: string }[];
};

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** `Name <address>` or a bare address, as Mailpit wants it. */
function contact(value: string): { Email: string; Name?: string } {
  const named = /^([^<>"]+) <([^<>\s]+)>$/.exec(value);
  return named ? { Email: named[2], Name: named[1].trim() } : { Email: value };
}

export async function sendToLocalInbox(
  baseUrl: string,
  email: LocalEmail,
  fetcher: Fetch = fetch,
): Promise<{ id: string } | { error: string }> {
  const response = await fetcher(`${baseUrl}/api/v1/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      From: contact(email.from),
      To: [{ Email: email.to }],
      Subject: email.subject,
      HTML: email.html,
      Text: email.text,
      // The template name, so Mailpit can filter by it. The log ID stays out.
      Tags: email.tags.filter((tag) => tag.name === "template").map((tag) => tag.value),
    }),
  });
  if (!response.ok) {
    return { error: `The local inbox answered ${response.status}: ${(await response.text()).trim()}` };
  }
  const body: unknown = await response.json().catch(() => null);
  const id = body && typeof body === "object" && "ID" in body && typeof body.ID === "string" ? body.ID : null;
  return id ? { id } : { error: "The local inbox didn't return an ID" };
}
