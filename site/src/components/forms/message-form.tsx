"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import {
  type FocusEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Button } from "@/components/button";
import { site } from "@/content/site";
import { submitMessage } from "@/lib/forms/actions";
import { ELAPSED_FIELD } from "@/lib/forms/guard";
import { checkMessage, type FieldErrors, type MessageKind, readMessageInput } from "@/lib/forms/schemas";
import { Honeypot } from "./fields";
import { FormSent, type SentProps } from "./form-sent";

// The spinner shows at least this long, so a fast send doesn't just flicker.
const MIN_PENDING_MS = 600;
const FAILED = "That didn't send. Check your connection and try again.";

const noSubscribe = () => () => {};

/** False in the server's HTML, true once the page's script is running. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function check(kind: MessageKind, form: HTMLFormElement): FieldErrors {
  const result = checkMessage(kind, readMessageInput(new FormData(form)));
  return result.ok ? {} : result.errors;
}

type Props = {
  kind: MessageKind;
  submitLabel: string;
  /** A line under the button, like what happens next or a link to the Privacy page. */
  finePrint?: ReactNode;
  sent: Omit<SentProps, "kind" | "firstName" | "onAgain">;
  /** The fields. They get every field's problem and remount after "send another". */
  children: (errors: FieldErrors) => ReactNode;
};

/**
 * The shell every message form shares. It checks the answers on the page
 * first, with the same rules the server uses, and shows every problem at
 * once. After a first try, a problem clears as soon as it's fixed, but a
 * new one only shows when the person leaves the field or tries again.
 * Then it sends, and swaps the form for a thank-you.
 */
export function MessageForm({ kind, submitLabel, finePrint, sent, children }: Props) {
  const hydrated = useHydrated();
  const startedAt = useRef(0);
  const focusFirstProblem = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [round, setRound] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [tried, setTried] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startedAt.current = Date.now();
    // After "send another", start them at the top instead of losing the focus.
    if (round === 0) return;
    const first = formRef.current?.querySelector<HTMLElement>("input:not([tabindex='-1']), textarea");
    first?.focus({ preventScroll: true });
    first?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [round]);

  useEffect(() => {
    if (!focusFirstProblem.current) return;
    focusFirstProblem.current = false;
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid]');
    if (!field) return;
    field.focus({ preventScroll: true });
    // Centered, so neither the top bar nor the tab bar covers it.
    field.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "instant" : "smooth" });
  }, [errors]);

  function showProblems(next: FieldErrors) {
    focusFirstProblem.current = true;
    setErrors(next);
  }

  // While fixing: drop the problems that are gone, but don't add new ones mid-word.
  function handleChange(event: FormEvent<HTMLFormElement>) {
    if (!tried) return;
    const now = check(kind, event.currentTarget);
    setErrors((shown) => {
      const fixed = (Object.keys(shown) as (keyof FieldErrors)[]).filter((field) => !now[field]);
      if (fixed.length === 0) return shown;
      const next = { ...shown };
      for (const field of fixed) delete next[field];
      return next;
    });
  }

  // Leaving a field: update the problems it's part of.
  function handleBlur(event: FocusEvent<HTMLFormElement>) {
    if (!tried || !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return;
    const field = event.target.name as keyof FieldErrors;
    const now = check(kind, event.currentTarget);
    const related: (keyof FieldErrors)[] = field === "email" || field === "phone" ? [field, "reach"] : [field];
    setErrors((shown) => {
      const next = { ...shown };
      for (const key of related) {
        if (now[key]) next[key] = now[key];
        else delete next[key];
      }
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setTried(true);
    setFailure(null);

    const result = checkMessage(kind, readMessageInput(data));
    if (!result.ok) {
      showProblems(result.errors);
      return;
    }
    setErrors({});
    data.set(ELAPSED_FIELD, String(Date.now() - startedAt.current));

    startTransition(async () => {
      try {
        const [reply] = await Promise.all([
          submitMessage(kind, data),
          new Promise((resolve) => window.setTimeout(resolve, MIN_PENDING_MS)),
        ]);
        if (reply.status === "sent") setFirstName(reply.firstName);
        else if (reply.status === "invalid") showProblems(reply.errors);
        else setFailure(reply.message);
      } catch {
        // Offline, or a new deploy retired this page's action.
        setFailure(FAILED);
      }
    });
  }

  function again() {
    setFirstName(null);
    setErrors({});
    setTried(false);
    setRound((count) => count + 1);
  }

  if (firstName !== null) {
    return <FormSent kind={kind} firstName={firstName} onAgain={again} {...sent} />;
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      onChange={handleChange}
      onBlur={handleBlur}
      className="relative grid gap-7"
    >
      <Honeypot />
      {children(errors)}

      <div className="mt-1 border-t border-line pt-6">
        {failure && (
          <p role="alert" className="mb-4 flex gap-2.5 rounded-tile bg-danger/10 p-4 text-small font-medium text-danger">
            <TriangleAlert aria-hidden className="size-5 shrink-0" />
            {failure}
          </p>
        )}
        {tried && Object.keys(errors).length > 0 && (
          <p className="mb-4 text-small font-medium text-danger">
            {Object.keys(errors).length === 1 ? "Fix the one thing above, then send." : "Fix the things marked above, then send."}
          </p>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button
            type="submit"
            size="lg"
            disabled={!hydrated}
            aria-disabled={pending || undefined}
            className="w-full sm:w-auto"
          >
            {pending ? (
              <>
                <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
                Sending…
              </>
            ) : (
              submitLabel
            )}
          </Button>
          {finePrint && <p className="text-small text-pretty text-muted">{finePrint}</p>}
        </div>
        <p aria-live="polite" className="sr-only">
          {pending ? "Sending" : ""}
        </p>
        <noscript>
          <p className="mt-4 text-small text-muted">
            This form needs JavaScript. You can email us at{" "}
            <a href={`mailto:${site.email}`} className="font-medium text-fg underline underline-offset-4">
              {site.email}
            </a>{" "}
            instead.
          </p>
        </noscript>
      </div>
    </form>
  );
}
