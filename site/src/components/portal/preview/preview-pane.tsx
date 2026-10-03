"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlertIcon, MoonIcon, SunIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Alert, AlertDescription, AlertTitle } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { Skeleton } from "@/components/portal/ui/skeleton";
import { PREVIEW_PATH } from "@/lib/host";
import { readFrameMessage, type HostMessage, type PreviewTheme } from "@/lib/portal/preview/messages";
import type { PreviewRequest } from "@/lib/portal/preview/preview";

/** How long the frame gets to load before the pane gives up on it. */
const FRAME_TIMEOUT_MS = 15_000;

const THEMES = [
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "light", label: "Light", Icon: SunIcon },
] as const satisfies readonly { value: PreviewTheme; label: string; Icon: LucideIcon }[];

type Status = { state: "loading" } | { state: "shown" } | { state: "problem"; problem: string };

/** The site follows each visitor's device, so the preview starts the way this one would show it. */
function deviceTheme(): PreviewTheme {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/**
 * The editors' Preview tab: the draft as the public site will show it, in
 * a frame that has the site's styles, so none of them reach the portal.
 * It sends the draft each time the tab opens with new values, and sizes
 * the frame to fit, so the page scrolls as one.
 */
export function PreviewPane({ request, active }: { request: PreviewRequest; active: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  /** Goes up each time the frame says it's ready, so a reloaded frame gets the draft again. */
  const [ready, setReady] = useState(0);
  const [theme, setTheme] = useState(deviceTheme);
  const [height, setHeight] = useState(0);
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [everShown, setEverShown] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const sent = useRef({ id: 0, key: "" });
  const key = JSON.stringify(request);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      const message = readFrameMessage(event.data);
      if (!message) return;
      if (message.type === "preview:ready") {
        sent.current.key = "";
        setTimedOut(false);
        setReady((count) => count + 1);
      } else if (message.type === "preview:height") {
        setHeight(message.height);
      } else if (message.id === sent.current.id) {
        if (message.type === "preview:shown") {
          setStatus({ state: "shown" });
          setEverShown(true);
        } else {
          setStatus({ state: "problem", problem: message.problem });
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (ready > 0 || !active) return;
    const timer = setTimeout(() => setTimedOut(true), FRAME_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready, active]);

  // The theme goes first, so the first preview already has it.
  useEffect(() => {
    if (ready > 0) tell(frame.current, { type: "preview:theme", theme });
  }, [ready, theme]);

  useEffect(() => {
    if (ready === 0 || !active || sent.current.key === key) return;
    const id = sent.current.id + 1;
    sent.current = { id, key };
    setStatus({ state: "loading" });
    tell(frame.current, { type: "preview:show", id, request: JSON.parse(key) });
  }, [ready, active, key]);

  const problem = timedOut ? "The preview didn't load. Reload the page and try again." : null;
  const shownProblem = problem ?? (status.state === "problem" ? status.problem : null);
  const loading = !shownProblem && status.state === "loading";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          How it will look on the site. Links and buttons don&apos;t work here.
        </p>
        <div role="group" aria-label="Site theme" className="flex gap-2">
          {THEMES.map(({ value, label, Icon }) => (
            <Button
              key={value}
              type="button"
              variant={theme === value ? "default" : "outline"}
              className="h-11 rounded-full px-4"
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
            >
              <Icon aria-hidden />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {shownProblem && (
        <Alert>
          <CircleAlertIcon />
          <AlertTitle>Can&apos;t preview it yet</AlertTitle>
          <AlertDescription>{shownProblem}</AlertDescription>
        </Alert>
      )}

      {loading && !everShown && (
        <div role="status" className="space-y-3">
          <span className="sr-only">Loading the preview…</span>
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      )}

      {/* Edge to edge on phones, like the site. */}
      <div
        hidden={Boolean(shownProblem)}
        aria-busy={loading}
        className={cn(
          "-mx-4 overflow-hidden transition-opacity sm:mx-0 sm:rounded-xl sm:border motion-reduce:transition-none",
          loading && everShown && "opacity-60",
          !everShown && "sm:border-0",
        )}
      >
        <iframe
          ref={frame}
          src={PREVIEW_PATH}
          title="Preview on the site"
          className="block w-full"
          style={{ height: everShown ? height : 0 }}
        />
      </div>
    </div>
  );
}

function tell(frame: HTMLIFrameElement | null, message: HostMessage) {
  frame?.contentWindow?.postMessage(message, location.origin);
}
