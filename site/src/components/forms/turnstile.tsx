"use client";

import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";

/**
 * Cloudflare Turnstile, the check that a form came from a person. It runs
 * as soon as the form shows, out of sight unless Cloudflare wants a click,
 * so a token is usually waiting by the time someone sends. Tokens last 5
 * minutes, and the widget fetches a fresh one when it runs out.
 */

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** How long a send waits for a token before calling the check broken. Not while Cloudflare waits on a click. */
const WAIT_MS = 15_000;

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string | null | undefined;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

/** Adds Cloudflare's script once per page, however many forms ask for it. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile didn't start")));
    script.onerror = () => {
      script.remove();
      loading = null;
      reject(new Error("Turnstile didn't load"));
    };
    document.head.append(script);
  });
  return loading;
}

/** A token to send, no check set up here (the server then decides), or a check that couldn't run. */
export type TokenResult = { status: "ready"; token: string } | { status: "off" } | { status: "failed" };

export type TurnstileHandle = {
  /** The current token, waiting for one if it's still coming. */
  token: () => Promise<TokenResult>;
  /** Starts a new check. A token works once, so call it after every send that didn't go through. */
  reset: () => void;
};

export function Turnstile({ action, ref }: { action: string; ref: Ref<TurnstileHandle> }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const token = useRef<string | null>(null);
  const failed = useRef(false);
  const interactive = useRef(false);
  const waiters = useRef(new Set<(result: TokenResult) => void>());
  const [askingForClick, setAskingForClick] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!siteKey || !element) return;
    let gone = false;
    const settle = (result: TokenResult) => {
      for (const waiter of waiters.current) waiter(result);
      waiters.current.clear();
    };
    const fail = () => {
      token.current = null;
      failed.current = true;
      settle({ status: "failed" });
    };

    loadTurnstile()
      .then((api) => {
        if (gone) return;
        const id = api.render(element, {
          sitekey: siteKey,
          action,
          theme: "auto",
          size: "flexible",
          appearance: "interaction-only",
          "response-field": false,
          callback: (value: string) => {
            token.current = value;
            failed.current = false;
            settle({ status: "ready", token: value });
          },
          "expired-callback": () => {
            token.current = null;
          },
          "before-interactive-callback": () => {
            interactive.current = true;
            setAskingForClick(true);
          },
          "after-interactive-callback": () => {
            interactive.current = false;
            setAskingForClick(false);
          },
          "timeout-callback": fail,
          "unsupported-callback": fail,
          "error-callback": () => {
            fail();
            // Handled here, and Cloudflare retries on its own.
            return true;
          },
        });
        if (id) widget.current = { api, id };
        else fail();
      })
      .catch((error: unknown) => {
        console.error("[forms] Couldn't load Turnstile", error);
        if (!gone) fail();
      });

    return () => {
      gone = true;
      if (widget.current) widget.current.api.remove(widget.current.id);
      widget.current = null;
      token.current = null;
    };
  }, [siteKey, action]);

  useImperativeHandle(
    ref,
    () => ({
      token: () => {
        if (!siteKey) return Promise.resolve({ status: "off" });
        if (token.current) return Promise.resolve({ status: "ready", token: token.current });
        if (failed.current) return Promise.resolve({ status: "failed" });
        return new Promise<TokenResult>((resolve) => {
          let timer = 0;
          const done = (result: TokenResult) => {
            window.clearTimeout(timer);
            waiters.current.delete(done);
            resolve(result);
          };
          // Someone answering Cloudflare's click gets as long as Cloudflare gives them.
          const wait = () => {
            timer = window.setTimeout(() => (interactive.current ? wait() : done({ status: "failed" })), WAIT_MS);
          };
          waiters.current.add(done);
          wait();
        });
      },
      reset: () => {
        token.current = null;
        failed.current = false;
        if (widget.current) widget.current.api.reset(widget.current.id);
      },
    }),
    [siteKey],
  );

  if (!siteKey) return null;
  // Takes no room until Cloudflare asks for a click.
  return (
    <div className={askingForClick ? "mb-4" : undefined}>
      {askingForClick && (
        <p className="mb-3 text-small font-medium text-pretty">
          One more step: check the box to show you&apos;re a person.
        </p>
      )}
      <div ref={container} />
    </div>
  );
}
