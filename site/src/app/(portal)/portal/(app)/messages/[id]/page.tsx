import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeftIcon,
  CircleCheckIcon,
  FlagIcon,
  ImagesIcon,
  MailIcon,
  MessageSquareTextIcon,
  PhoneIcon,
} from "lucide-react";
import { MessageBadges } from "@/components/portal/messages/message-badges";
import { MessageTriage } from "@/components/portal/messages/message-triage";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { formatDayLabel, laDateOf, todayInLA } from "@/lib/dates";
import { MESSAGE_SUMMARY, sentAt } from "@/lib/email/templates/form-alert";
import { readPortalEnv } from "@/lib/env";
import { answersOf, readAnswers } from "@/lib/forms/answers";
import { loadPeopleNames } from "@/lib/portal/activity/queries";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import {
  DEFAULT_MESSAGE_FILTERS,
  isClosed,
  KIND_LABELS,
  messagesHref,
  phoneHref,
  tabOf,
} from "@/lib/portal/messages/list";
import { loadAssignees, loadMessage } from "@/lib/portal/messages/queries";
import { loadTakedownPhotos } from "@/lib/portal/photos/queries";
import { hasRole } from "@/lib/portal/roles";

// The kind, never the sender's name, so names stay out of tab titles and history.
export async function generateMetadata({ params }: PageProps<"/portal/messages/[id]">): Promise<Metadata> {
  const me = await getCurrentUser();
  if (!me || !hasRole(me.roles, "site_messages")) return { title: "Messages" };
  const message = await loadMessage((await params).id);
  return { title: message ? `${KIND_LABELS[message.kind]} message` : "Messages" };
}

/** A mailto link that keeps the address as one, even with ? or & in it. */
function mailtoHref(email: string): string {
  return `mailto:${email.split("@").map(encodeURIComponent).join("@")}`;
}

const CONTACT_BUTTON = "h-11 min-w-0 flex-1 px-3 sm:flex-none sm:px-5";

export default async function MessagePage({ params }: PageProps<"/portal/messages/[id]">) {
  // The action checks again, and site.triage_message() after it.
  const me = await getCurrentUser();
  if (!me || !hasRole(me.roles, "site_messages")) notFound();
  const message = await loadMessage((await params).id);
  if (!message) notFound();

  const [assignees, names, takenDown] = await Promise.all([
    loadAssignees(),
    loadPeopleNames(),
    message.kind === "takedown" ? loadTakedownPhotos(message.id) : [],
  ]);
  const now = new Date();
  const today = todayInLA(now);
  // Staging shares production's data, so it doesn't change messages.
  const readOnly = readPortalEnv().appEnv === "staging";
  const firstName = message.name.trim().split(/\s+/)[0];
  const answers = answersOf(readAnswers(message.details));
  const written = message.message?.trim();
  const call = message.phone ? phoneHref(message.phone, "tel") : null;
  const text = message.phone ? phoneHref(message.phone, "sms") : null;
  const env = message.env === "staging" ? "staging" : "production";
  const back = messagesHref({ ...DEFAULT_MESSAGE_FILTERS, tab: tabOf(message.status), env });

  return (
    <NarrowPage className="space-y-8">
      <div className="space-y-3">
        <div>
          <Button variant="ghost" className="-ml-3 h-11 px-3 text-muted-foreground" asChild>
            <Link href={back}>
              <ChevronLeftIcon aria-hidden />
              Messages
            </Link>
          </Button>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{message.name}</h1>
          <p className="text-muted-foreground">{MESSAGE_SUMMARY[message.kind](firstName)}</p>
          <MessageBadges message={message} />
        </div>
      </div>

      {message.kind === "takedown" &&
        !isClosed(message.status) &&
        (takenDown.length > 0 ? (
          <Alert>
            <CircleCheckIcon />
            <AlertTitle>The photo is down</AlertTitle>
            <AlertDescription>
              <p>Reply to let them know it&apos;s gone, then mark it handled.</p>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <FlagIcon />
            <AlertTitle>Take the photo down first</AlertTitle>
            <AlertDescription>
              <p>Find the photo they mean and take it off the site, then reply to let them know it&apos;s gone.</p>
            </AlertDescription>
            {/* Photos only lists requests from the real site. */}
            {hasRole(me.roles, "site_editor") && message.env === "production" && (
              <div className="col-start-2 pt-3 pb-1">
                <Button asChild variant="outline" className="h-11 px-4 text-foreground">
                  <Link href={`/photos?takedown=${message.id}`}>
                    <ImagesIcon aria-hidden />
                    Find the photo
                  </Link>
                </Button>
              </div>
            )}
          </Alert>
        ))}

      {takenDown.length > 0 && (
        <section aria-labelledby="taken-down-heading" className="space-y-3">
          <h2 id="taken-down-heading" className="text-lg font-semibold">
            {takenDown.length === 1 ? "Photo taken down" : "Photos taken down"}
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {takenDown.map((photo) => (
              <li key={photo.id} className="space-y-1 p-4">
                <p className="break-words">{photo.alt}</p>
                <p className="text-sm text-muted-foreground">
                  {[
                    formatDayLabel(laDateOf(photo.removedAt), today),
                    photo.removedBy ? names.get(photo.removedBy) : undefined,
                    photo.reason,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="message-heading" className="space-y-3">
        <h2 id="message-heading" className="text-lg font-semibold">
          {written ? "What they wrote" : "What they told us"}
        </h2>
        <div className="space-y-4 rounded-xl border bg-card p-4">
          {written ? (
            <p className="whitespace-pre-line break-words">{written}</p>
          ) : (
            answers.length === 0 && <p className="text-muted-foreground">They didn&apos;t write a message.</p>
          )}
          {answers.length > 0 && (
            <dl className={written ? "space-y-2 border-t pt-4" : "space-y-2"}>
              {answers.map(([label, value]) => (
                <div key={label} className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Came in {sentAt(message.created_at)}.{" "}
          {message.notified_at
            ? "The youth inbox got an email about it."
            : "The email about it didn't go out, so the next daily digest lists it."}
        </p>
      </section>

      <section aria-labelledby="reach-heading" className="space-y-3">
        <h2 id="reach-heading" className="text-lg font-semibold">
          Reach {firstName}
        </h2>
        <dl className="divide-y overflow-hidden rounded-xl border bg-card">
          {message.email && (
            <div className="flex flex-wrap gap-x-3 p-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="min-w-0 break-all">{message.email}</dd>
            </div>
          )}
          {message.phone && (
            <div className="flex flex-wrap gap-x-3 p-4">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="min-w-0 break-all">{message.phone}</dd>
            </div>
          )}
        </dl>
        <div className="flex gap-2">
          {message.email && (
            <Button asChild variant="outline" className={CONTACT_BUTTON}>
              <a href={mailtoHref(message.email)}>
                <MailIcon aria-hidden />
                Email
              </a>
            </Button>
          )}
          {call && (
            <Button asChild variant="outline" className={CONTACT_BUTTON}>
              <a href={call}>
                <PhoneIcon aria-hidden />
                Call
              </a>
            </Button>
          )}
          {text && (
            <Button asChild variant="outline" className={CONTACT_BUTTON}>
              <a href={text}>
                <MessageSquareTextIcon aria-hidden />
                Text
              </a>
            </Button>
          )}
        </div>
      </section>

      <MessageTriage
        message={message}
        meId={me.id}
        assignees={assignees}
        names={Object.fromEntries(names)}
        nowIso={now.toISOString()}
        readOnly={readOnly}
      />
    </NarrowPage>
  );
}
