"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { readHostMessage, type FrameMessage } from "@/lib/portal/preview/messages";
import type { PreviewResult } from "@/lib/portal/preview/preview";

const OFFLINE = "Couldn't load the preview. Check your connection and try again.";

/**
 * The inside of the editors' preview frame, on a page with the public
 * site's styles. The editor sends the draft, the server renders it with
 * the site's own components, and this shows it. Links and buttons do
 * nothing here, so tapping one can't leave the preview.
 */
export function PreviewFrame({ render }: { render: (request: unknown) => Promise<PreviewResult> }) {
  const [node, setNode] = useState<ReactNode>(null);
  const [, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef(0);

  useEffect(() => {
    function tell(message: FrameMessage) {
      window.parent.postMessage(message, location.origin);
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== window.parent) return;
      const message = readHostMessage(event.data);
      if (message?.type === "preview:theme") {
        // The public site's own switch: `data-theme` on any element forces its look.
        document.documentElement.dataset.theme = message.theme;
      } else if (message?.type === "preview:show") {
        const { id, request } = message;
        latest.current = id;
        startTransition(async () => {
          let result: PreviewResult;
          try {
            result = await render(request);
          } catch {
            result = { problem: OFFLINE };
          }
          // A newer draft is on its way, so this one is already out of date.
          if (id !== latest.current) return;
          if ("problem" in result) {
            tell({ type: "preview:problem", id, problem: result.problem });
          } else {
            setNode(result.node);
            tell({ type: "preview:shown", id });
          }
        });
      }
    }

    window.addEventListener("message", onMessage);
    tell({ type: "preview:ready" });
    return () => window.removeEventListener("message", onMessage);
  }, [render]);

  // The editor sizes the frame to fit, so it scrolls with the page instead of inside itself.
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const report = () => {
      window.parent.postMessage({ type: "preview:height", height: element.offsetHeight }, location.origin);
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [node]);

  return (
    <div
      ref={root}
      onClickCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {node}
    </div>
  );
}
