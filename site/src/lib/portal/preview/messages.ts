/**
 * What the editor and its preview frame say to each other. Both pages
 * check a message came from the other one first, and these check its
 * shape. The frame answers each `show` with its `id`, so the editor can
 * tell an old answer from the latest one.
 */

export type PreviewTheme = "dark" | "light";

/** From the editor to the frame. */
export type HostMessage =
  | { type: "preview:show"; id: number; request: unknown }
  | { type: "preview:theme"; theme: PreviewTheme };

/** From the frame to the editor. */
export type FrameMessage =
  | { type: "preview:ready" }
  | { type: "preview:height"; height: number }
  | { type: "preview:shown"; id: number }
  | { type: "preview:problem"; id: number; problem: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const isId = (value: unknown): value is number => Number.isSafeInteger(value);

export function readHostMessage(data: unknown): HostMessage | null {
  if (!isRecord(data)) return null;
  if (data.type === "preview:show" && isId(data.id) && "request" in data) {
    return { type: "preview:show", id: data.id, request: data.request };
  }
  if (data.type === "preview:theme" && (data.theme === "dark" || data.theme === "light")) {
    return { type: "preview:theme", theme: data.theme };
  }
  return null;
}

export function readFrameMessage(data: unknown): FrameMessage | null {
  if (!isRecord(data)) return null;
  switch (data.type) {
    case "preview:ready":
      return { type: "preview:ready" };
    case "preview:height": {
      const { height } = data;
      return typeof height === "number" && Number.isFinite(height) && height >= 0
        ? { type: "preview:height", height: Math.ceil(height) }
        : null;
    }
    case "preview:shown":
      return isId(data.id) ? { type: "preview:shown", id: data.id } : null;
    case "preview:problem":
      return isId(data.id) && typeof data.problem === "string"
        ? { type: "preview:problem", id: data.id, problem: data.problem }
        : null;
    default:
      return null;
  }
}
