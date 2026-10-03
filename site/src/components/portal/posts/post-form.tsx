"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import {
  ArrowUpRightIcon,
  CalendarClockIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { describedBy, FormField } from "@/components/portal/form-field";
import { PreviewPane } from "@/components/portal/preview/preview-pane";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { Input } from "@/components/portal/ui/input";
import { Label } from "@/components/portal/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/portal/ui/radio-group";
import { Switch } from "@/components/portal/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/portal/ui/tabs";
import { Textarea } from "@/components/portal/ui/textarea";
import { savePost, type SaveResult } from "@/lib/portal/posts/actions";
import { composerStart, matchingPreset, nextHour, primaryAction } from "@/lib/portal/posts/composer";
import { when, windowSummary, type PostState } from "@/lib/portal/posts/list";
import { presetEnd, PRESETS, type PresetId } from "@/lib/portal/posts/presets";
import { formValues, type SaveIntent } from "@/lib/portal/posts/save";
import {
  checkPost,
  fromLocalInput,
  POST_LIMITS,
  toLocalInput,
  type PostErrors,
  type PostValues,
} from "@/lib/portal/posts/schema";
import { TEMPLATES, type PostTemplate } from "@/lib/portal/posts/templates";

type Done = Extract<SaveResult, { status: "done" }>;

/** The order fields are checked in, for focusing the first problem. */
const FIELD_ORDER: (keyof PostErrors)[] = ["title", "body", "tone", "linkUrl", "linkLabel", "startsAt", "endsAt"];
const FIELD_IDS: Record<keyof PostErrors, string> = {
  title: "post-title",
  body: "post-body",
  tone: "post-tone-info",
  linkUrl: "post-link",
  linkLabel: "post-link-label",
  startsAt: "post-start-at",
  endsAt: "post-end",
};

/** A tappable row in a list of radio buttons, with room for a description. */
const OPTION_ROW = "min-h-11 cursor-pointer items-start gap-3 px-4 py-3 font-normal leading-snug";

const TONES = [
  { value: "info", title: "Heads-up", description: "News, merch, or something coming up." },
  {
    value: "cancellation",
    title: "Change of plans",
    description: "A night off or a change to the usual. It's tagged Change of plans on the site.",
  },
];

/** Which part of the site a heads-up shows on, for the link after posting. */
const THIS_WEEK_PATH = "/this-week";

/**
 * Writes a heads-up, or changes one. A new one can start from a template.
 * It goes up now or later, and comes down at a quick end time or one
 * picked by hand. One that's already up keeps its start.
 */
export function PostForm({
  id,
  initial,
  state,
  liveStart,
  nowIso,
  siteUrl,
  showTemplates,
  readOnly,
}: {
  /** Null for a new heads-up. */
  id: string | null;
  initial: PostValues;
  /** Where it stands now. Null for a new heads-up. */
  state: Exclude<PostState, "past"> | null;
  /** A live heads-up's start, which saving keeps. */
  liveStart: string | null;
  /** The server's clock, so the first render matches it. */
  nowIso: string;
  /** The public site, for a link to the heads-up once it's up. */
  siteUrl: string;
  showTemplates: boolean;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date(nowIso));
  const [values, setValues] = useState(initial);
  const [later, setLater] = useState(initial.startsAt !== "");
  const [laterAt, setLaterAt] = useState(() => initial.startsAt || nextHour(new Date(nowIso)));
  const [errors, setErrors] = useState<PostErrors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [saved, setSaved] = useState<Done | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [doing, setDoing] = useState<SaveIntent | null>(null);
  const [tab, setTab] = useState("edit");
  // The preview loads the first time it's opened, then stays ready.
  const [previewed, setPreviewed] = useState(false);
  const [pending, startTransition] = useTransition();
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const startingOver = useRef(false);

  // The summary and the main button depend on the time, so keep it current while the page is open.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Focus follows the swap: to the result once it's in, and back to Title for another heads-up.
  useEffect(() => {
    if (done) {
      doneHeading.current?.focus();
    } else if (startingOver.current) {
      startingOver.current = false;
      document.getElementById(FIELD_IDS.title)?.focus();
    }
  }, [done]);

  const startsAt = liveStart || !later ? "" : laterAt;
  const start = composerStart(startsAt, liveStart, now);
  const end = fromLocalInput(values.endsAt);
  const preset = matchingPreset(start, values.endsAt);
  const primary = primaryAction(state, start, now);
  const showLabel = values.linkUrl.trim() !== "" || values.linkLabel !== "" || Boolean(errors.linkLabel);
  const summaryStart = liveStart ? new Date(liveStart) : later ? fromLocalInput(laterAt) : null;
  const summary = windowSummary(summaryStart, end, now);

  function set<K extends keyof PostValues>(field: K, value: PostValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    if (field in FIELD_IDS) clearError(field as keyof PostErrors);
    setSaved(null);
  }

  function clearError(field: keyof PostErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function showErrors(found: PostErrors) {
    setErrors(found);
    const first = FIELD_ORDER.find((field) => found[field]);
    if (!first) return;
    // The field has to be on screen to take focus.
    flushSync(() => setTab("edit"));
    document.getElementById(FIELD_IDS[first])?.focus();
  }

  function openTab(next: string) {
    if (next === "preview") setPreviewed(true);
    setTab(next);
  }

  /** Moves the start, and a quick end along with it, so "This week" stays the week it starts in. */
  function moveStart(nextLater: boolean, nextAt: string) {
    const nextStart = composerStart(nextLater ? nextAt : "", liveStart, now);
    if (preset) set("endsAt", toLocalInput(presetEnd(preset, nextStart)));
    setLater(nextLater);
    setLaterAt(nextAt);
    clearError("startsAt");
    setSaved(null);
  }

  function pickPreset(id: PresetId) {
    set("endsAt", toLocalInput(presetEnd(id, start)));
  }

  function applyTemplate(template: PostTemplate) {
    setValues((current) => ({
      ...current,
      ...template.values,
      endsAt: toLocalInput(presetEnd(template.preset, start)),
    }));
    setErrors({});
    setApplied(template.label);
  }

  function submit(intent: SaveIntent) {
    setAlert(null);
    setSaved(null);
    const sent = { ...values, startsAt };
    const check = checkPost(sent, { now: new Date(), keepStart: liveStart ? new Date(liveStart) : undefined });
    const found: PostErrors = check.ok ? {} : { ...check.errors };
    // A blank start means now, so a cleared time under "At a set time" would put it up right away.
    if (startsAt === "" && later && !liveStart) {
      found.startsAt = "Pick a time, or choose “As soon as it's published.”";
    }
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }

    setDoing(intent);
    startTransition(async () => {
      let result: SaveResult;
      try {
        result = await savePost(id, sent, intent);
      } catch {
        setAlert("Couldn't save the heads-up. Check your connection and try again.");
        return;
      }
      if (result.status === "invalid") showErrors(result.errors);
      else if (result.status === "failed") setAlert(result.message);
      else if (id === null) setDone(result);
      else {
        // The page reads it again, so where it stands and what can be done with it catch up.
        setSaved(result);
        router.refresh();
      }
    });
  }

  function reset() {
    const fresh = new Date();
    setNow(fresh);
    setValues(formValues(null, fresh));
    setLater(false);
    setLaterAt(nextHour(fresh));
    setErrors({});
    setAlert(null);
    setApplied(null);
    setTab("edit");
    setPreviewed(false);
    setDone(null);
    startingOver.current = true;
    // Posting one again starts from its words, so a fresh one drops them from the address.
    if (!showTemplates) router.replace("/posts/new");
  }

  if (done) {
    return (
      <PostDone
        title={values.title.trim()}
        result={done}
        siteUrl={siteUrl}
        headingRef={doneHeading}
        onAnother={reset}
      />
    );
  }

  const busy = readOnly || pending;

  return (
    <div className="space-y-6">
      {readOnly && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            This is the staging copy of the portal, so it can&apos;t change heads-ups. Use the real portal to post.
          </AlertDescription>
        </Alert>
      )}

      <form noValidate onSubmit={(event) => event.preventDefault()} className="space-y-6">
        <Tabs value={tab} onValueChange={openTab} className="gap-6">
          <TabsList className="w-full group-data-horizontal/tabs:h-11">
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" forceMount className="space-y-6 text-base data-[state=inactive]:hidden">
            {showTemplates && (
              <div className="space-y-2">
                <p id="post-templates-label" className="text-sm font-medium">
                  Start from
                </p>
                <div role="group" aria-labelledby="post-templates-label" className="flex flex-wrap gap-2">
                  {TEMPLATES.map((template) => (
                    <Button
                      key={template.id}
                      type="button"
                      variant="outline"
                      className="h-11 rounded-full px-4"
                      disabled={busy}
                      onClick={() => applyTemplate(template)}
                    >
                      {template.label}
                    </Button>
                  ))}
                </div>
                <p role="status" className="text-xs text-muted-foreground">
                  {applied
                    ? `Filled in from ${applied}. Change anything you like.`
                    : "Fills in the words and times. You can change all of it."}
                </p>
              </div>
            )}

            <fieldset disabled={busy} className="min-w-0 space-y-6">
              <FormField
                id={FIELD_IDS.title}
                label="Title"
                hint={`${values.title.length} of ${POST_LIMITS.title} characters.`}
                error={errors.title}
              >
                <Input
                  id={FIELD_IDS.title}
                  autoComplete="off"
                  autoCapitalize="sentences"
                  maxLength={POST_LIMITS.title}
                  className="h-11"
                  value={values.title}
                  aria-invalid={errors.title ? true : undefined}
                  aria-describedby={describedBy(FIELD_IDS.title, errors.title, true)}
                  onChange={(event) => set("title", event.target.value)}
                />
              </FormField>

              <FormField
                id={FIELD_IDS.body}
                label="Message"
                optional
                hint={`A sentence or two. ${values.body.length} of ${POST_LIMITS.body} characters.`}
                error={errors.body}
              >
                <Textarea
                  id={FIELD_IDS.body}
                  rows={3}
                  autoCapitalize="sentences"
                  maxLength={POST_LIMITS.body}
                  className="min-h-24"
                  value={values.body}
                  aria-invalid={errors.body ? true : undefined}
                  aria-describedby={describedBy(FIELD_IDS.body, errors.body, true)}
                  onChange={(event) => set("body", event.target.value)}
                />
              </FormField>

              <FormField id="post-tone" label="Kind" error={errors.tone} group>
                <RadioGroup
                  value={values.tone}
                  onValueChange={(value) => set("tone", value)}
                  aria-labelledby="post-tone-label"
                  aria-describedby={describedBy("post-tone", errors.tone)}
                  className="gap-0 divide-y overflow-hidden rounded-xl border bg-card"
                >
                  {TONES.map((tone) => {
                    const toneId = `post-tone-${tone.value}`;
                    return (
                      <Label key={tone.value} htmlFor={toneId} className={OPTION_ROW}>
                        <RadioGroupItem
                          id={toneId}
                          value={tone.value}
                          className="mt-0.5"
                          aria-invalid={errors.tone ? true : undefined}
                          aria-labelledby={`${toneId}-title`}
                          aria-describedby={`${toneId}-description`}
                        />
                        <span className="min-w-0 space-y-0.5">
                          <span id={`${toneId}-title`} className="block text-base font-medium desktop:text-sm">
                            {tone.title}
                          </span>
                          <span id={`${toneId}-description`} className="block text-sm text-muted-foreground">
                            {tone.description}
                          </span>
                        </span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </FormField>

              <FormField
                id={FIELD_IDS.linkUrl}
                label="Link"
                optional
                hint="Adds a button. Use a page on the site like /events, or a full link."
                error={errors.linkUrl}
              >
                <Input
                  id={FIELD_IDS.linkUrl}
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={POST_LIMITS.link}
                  className="h-11"
                  value={values.linkUrl}
                  aria-invalid={errors.linkUrl ? true : undefined}
                  aria-describedby={describedBy(FIELD_IDS.linkUrl, errors.linkUrl, true)}
                  onChange={(event) => {
                    set("linkUrl", event.target.value);
                    clearError("linkLabel");
                  }}
                />
              </FormField>

              {showLabel && (
                <FormField
                  id={FIELD_IDS.linkLabel}
                  label="Button text"
                  optional
                  hint="Leave it blank for “Learn more”."
                  error={errors.linkLabel}
                >
                  <Input
                    id={FIELD_IDS.linkLabel}
                    autoComplete="off"
                    maxLength={POST_LIMITS.linkLabel}
                    placeholder="Learn more"
                    className="h-11"
                    value={values.linkLabel}
                    aria-invalid={errors.linkLabel ? true : undefined}
                    aria-describedby={describedBy(FIELD_IDS.linkLabel, errors.linkLabel, true)}
                    onChange={(event) => set("linkLabel", event.target.value)}
                  />
                </FormField>
              )}

              <Label htmlFor="post-pinned" className={`${OPTION_ROW} justify-between rounded-xl border bg-card`}>
                <span className="min-w-0 space-y-0.5">
                  <span id="post-pinned-title" className="block text-base font-medium desktop:text-sm">
                    Pin it
                  </span>
                  <span id="post-pinned-description" className="block text-sm text-muted-foreground">
                    Pinned heads-ups come first, so the newest pinned one is the one on Home.
                  </span>
                </span>
                <Switch
                  id="post-pinned"
                  className="mt-0.5"
                  checked={values.pinned}
                  aria-labelledby="post-pinned-title"
                  aria-describedby="post-pinned-description"
                  onCheckedChange={(checked) => set("pinned", checked)}
                />
              </Label>

              {liveStart ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Goes up</p>
                  <p className="text-sm text-muted-foreground">
                    It&apos;s been up since {when(liveStart, now)}. To start it again later, end it and post it again.
                  </p>
                </div>
              ) : (
                <FormField id="post-start" label="Goes up" error={errors.startsAt} group>
                  <RadioGroup
                    value={later ? "later" : "now"}
                    onValueChange={(value) => moveStart(value === "later", laterAt)}
                    aria-labelledby="post-start-label"
                    aria-describedby={describedBy("post-start", errors.startsAt)}
                    className="gap-0 divide-y overflow-hidden rounded-xl border bg-card"
                  >
                    <Label htmlFor="post-start-now" className={OPTION_ROW}>
                      <RadioGroupItem id="post-start-now" value="now" className="mt-0.5" />
                      <span className="text-base font-medium desktop:text-sm">As soon as it&apos;s published</span>
                    </Label>
                    <div className="space-y-3 px-4 py-3">
                      <Label htmlFor="post-start-later" className="cursor-pointer items-start gap-3 font-normal">
                        <RadioGroupItem id="post-start-later" value="later" className="mt-0.5" />
                        <span className="text-base font-medium desktop:text-sm">At a set time</span>
                      </Label>
                      {later && (
                        <Input
                          id={FIELD_IDS.startsAt}
                          type="datetime-local"
                          aria-label="Start date and time"
                          className="h-11"
                          value={laterAt}
                          aria-invalid={errors.startsAt ? true : undefined}
                          aria-describedby={describedBy("post-start", errors.startsAt)}
                          onChange={(event) => moveStart(true, event.target.value)}
                        />
                      )}
                    </div>
                  </RadioGroup>
                </FormField>
              )}

              <FormField id={FIELD_IDS.endsAt} label="Comes down" error={errors.endsAt}>
                <div role="group" aria-label="Quick end times" className="flex flex-wrap gap-2">
                  {PRESETS.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant={preset === option.id ? "default" : "outline"}
                      className="h-11 rounded-full px-4"
                      aria-pressed={preset === option.id}
                      onClick={() => pickPreset(option.id)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <Input
                  id={FIELD_IDS.endsAt}
                  type="datetime-local"
                  className="h-11"
                  value={values.endsAt}
                  aria-invalid={errors.endsAt ? true : undefined}
                  aria-describedby={describedBy(FIELD_IDS.endsAt, errors.endsAt)}
                  onChange={(event) => set("endsAt", event.target.value)}
                />
              </FormField>

              <p className="flex items-start gap-2 rounded-xl bg-muted/60 px-4 py-3 text-sm">
                <CalendarClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                {summary}
              </p>
            </fieldset>
          </TabsContent>

          <TabsContent value="preview" forceMount className="text-base data-[state=inactive]:hidden">
            {previewed && (
              <PreviewPane request={{ kind: "post", values: { ...values, startsAt } }} active={tab === "preview"} />
            )}
          </TabsContent>
        </Tabs>

        {/* Saving works from either tab. */}
        <fieldset disabled={busy} className="min-w-0 space-y-6">
          {alert && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{alert}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="h-11 px-6" onClick={() => submit("publish")}>
              {pending && doing === "publish" ? primary.pending : primary.label}
            </Button>
            {(state === null || state === "draft") && (
              <Button type="button" variant="outline" className="h-11 px-6" onClick={() => submit("draft")}>
                {pending && doing === "draft" ? "Saving…" : "Save draft"}
              </Button>
            )}
          </div>

          {saved && (
            <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
              <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {saved.message}
                {saved.state === "live" && (
                  <>
                    {" "}
                    <a
                      href={`${siteUrl}${THIS_WEEK_PATH}`}
                      target="_blank"
                      rel="noopener"
                      className="font-medium text-foreground underline underline-offset-4"
                    >
                      See it on the site
                    </a>
                  </>
                )}
              </span>
            </p>
          )}
        </fieldset>
      </form>
    </div>
  );
}

/** A new heads-up is saved: where it stands, and where to go next. */
function PostDone({
  title,
  result,
  siteUrl,
  headingRef,
  onAnother,
}: {
  title: string;
  result: Done;
  siteUrl: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onAnother: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
        <CircleCheckIcon className="size-6 text-muted-foreground" aria-hidden />
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-pretty outline-none">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{result.message}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button asChild className="h-11 px-6">
          <Link href="/posts">Back to Posts</Link>
        </Button>
        {result.state === "live" && (
          <Button asChild variant="outline" className="h-11 px-6">
            <a href={`${siteUrl}${THIS_WEEK_PATH}`} target="_blank" rel="noopener">
              See it on the site
              <ArrowUpRightIcon aria-hidden />
            </a>
          </Button>
        )}
        <Button asChild variant="outline" className="h-11 px-6">
          <Link href={`/posts/${result.id}`}>Keep editing</Link>
        </Button>
        <Button type="button" variant="ghost" className="h-11 px-6" onClick={onAnother}>
          Write another
        </Button>
      </div>
    </div>
  );
}
