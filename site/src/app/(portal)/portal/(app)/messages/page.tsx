import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlaskConicalIcon, InboxIcon } from "lucide-react";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { MessageKindChips, MessageTabs } from "@/components/portal/messages/message-filters";
import { MessageRows, MessageSection } from "@/components/portal/messages/message-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { loadPeopleNames } from "@/lib/portal/activity/queries";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import {
  DEFAULT_MESSAGE_FILTERS,
  KIND_LABELS,
  messagesHref,
  parseMessageFilters,
  TAB_LABELS,
  type MessageFilters,
} from "@/lib/portal/messages/list";
import { loadMessageCounts, loadMessages } from "@/lib/portal/messages/queries";
import { hasRole } from "@/lib/portal/roles";

export const metadata: Metadata = {
  title: "Messages",
};

/** What an empty tab says, and where to look instead. */
function emptyText(filters: MessageFilters): { title: string; text: string } {
  if (filters.kind !== "all") {
    return {
      title: `No ${KIND_LABELS[filters.kind].toLowerCase()} messages in ${TAB_LABELS[filters.tab]}`,
      text: "Choose All to see every kind.",
    };
  }
  switch (filters.tab) {
    case "new":
      return {
        title: "You're all caught up",
        text: "Messages from Plan a visit, Join, Serve, and Contact land here, and the youth inbox gets an email for each.",
      };
    case "in_progress":
      return {
        title: "Nothing in progress",
        text: "Pick up a new message to move it here, so other leaders know someone has it.",
      };
    case "handled":
      return { title: "Nothing handled yet", text: "Messages marked handled or spam move here." };
  }
}

export default async function MessagesPage({ searchParams }: PageProps<"/portal/messages">) {
  // The Messages role and owners. RLS keeps everyone else from reading messages anyway.
  const me = await getCurrentUser();
  if (!me || !hasRole(me.roles, "site_messages")) notFound();

  const filters = parseMessageFilters(await searchParams);
  const now = new Date();
  const [list, counts, names] = await Promise.all([
    loadMessages(filters),
    loadMessageCounts(filters.env, filters.kind),
    loadPeopleNames(),
  ]);
  const people = { names, meId: me.id };
  const open = filters.tab !== "handled";
  const empty = list.takedowns.length === 0 && list.messages.length === 0;
  const staging = filters.env === "staging";
  const { title, text } = emptyText(filters);

  return (
    <NarrowPage className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">What people send from the site&apos;s forms.</p>
      </header>

      {staging && (
        <Alert>
          <FlaskConicalIcon />
          <AlertTitle>Staging tests</AlertTitle>
          <AlertDescription>
            <p>
              These came from the staging site, so nobody real sent them.{" "}
              <Link href={messagesHref(DEFAULT_MESSAGE_FILTERS)} className="font-medium underline">
                Back to real messages
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <MessageTabs filters={filters} counts={counts} />
        <MessageKindChips filters={filters} />
      </div>

      {empty ? (
        <section aria-labelledby="empty-heading" className="space-y-3 rounded-xl border border-dashed p-6 text-center">
          <InboxIcon className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <h2 id="empty-heading" className="font-semibold">
              {title}
            </h2>
            <p className="text-sm text-balance text-muted-foreground">{text}</p>
          </div>
          {filters.kind !== "all" && (
            <Button asChild variant="outline" className="h-11 px-5">
              <Link href={messagesHref(filters, { kind: "all" })}>Show all kinds</Link>
            </Button>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          {open
            ? "Oldest first, so nobody waits too long."
            : "Most recently closed first. Spam goes after 30 days, and handled messages after a year."}
        </p>
      )}

      <MessageSection
        id="takedowns"
        title="Photo takedowns"
        description="Someone wants a photo taken down. Take it down first, then reply."
        count={list.takedowns.length}
      >
        <MessageRows messages={list.takedowns} now={now} people={people} />
      </MessageSection>

      {list.takedowns.length > 0 ? (
        <MessageSection id="others" title="Everything else" count={counts[filters.tab] - list.takedowns.length}>
          <MessageRows messages={list.messages} now={now} people={people} />
        </MessageSection>
      ) : (
        list.messages.length > 0 && <MessageRows messages={list.messages} now={now} people={people} />
      )}

      {list.hasMore && (
        <Button asChild variant="outline" className="h-11 w-full sm:w-auto sm:px-6">
          <Link href={messagesHref(filters, { pages: filters.pages + 1 })} scroll={false}>
            Show more
          </Link>
        </Button>
      )}

      {!staging && (
        <p className="border-t pt-6 text-sm text-muted-foreground">
          Testing the forms on staging?{" "}
          <Link
            href={messagesHref({ ...DEFAULT_MESSAGE_FILTERS, env: "staging" })}
            className="font-medium text-foreground underline"
          >
            See staging tests
          </Link>
        </p>
      )}
    </NarrowPage>
  );
}
