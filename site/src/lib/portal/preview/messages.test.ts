import { describe, expect, it } from "vitest";
import { readFrameMessage, readHostMessage } from "./messages";

describe("readHostMessage", () => {
  it("takes what to show and the theme", () => {
    const request = { kind: "post", values: {} };
    const show = { type: "preview:show", id: 2, request };
    expect(readHostMessage(show)).toEqual(show);
    expect(readHostMessage({ type: "preview:theme", theme: "light" })).toEqual({ type: "preview:theme", theme: "light" });
  });

  it("ignores anything else", () => {
    expect(readHostMessage(null)).toBeNull();
    expect(readHostMessage("preview:show")).toBeNull();
    expect(readHostMessage({ type: "preview:show", request: {} })).toBeNull();
    expect(readHostMessage({ type: "preview:theme", theme: "grey" })).toBeNull();
    expect(readHostMessage({ type: "preview:ready" })).toBeNull();
    expect(readHostMessage({ type: "something-else" })).toBeNull();
  });
});

describe("readFrameMessage", () => {
  it("takes the frame's ready, height, shown, and problem", () => {
    expect(readFrameMessage({ type: "preview:ready" })).toEqual({ type: "preview:ready" });
    const height = readFrameMessage({ type: "preview:height", height: 812.5 });
    expect(height).toEqual({ type: "preview:height", height: 813 });
    expect(readFrameMessage({ type: "preview:shown", id: 3 })).toEqual({ type: "preview:shown", id: 3 });
    expect(readFrameMessage({ type: "preview:problem", id: 4, problem: "Pick the day it starts." })).toEqual({
      type: "preview:problem",
      id: 4,
      problem: "Pick the day it starts.",
    });
  });

  it("ignores anything else", () => {
    expect(readFrameMessage(undefined)).toBeNull();
    expect(readFrameMessage({ type: "preview:height", height: -1 })).toBeNull();
    expect(readFrameMessage({ type: "preview:height", height: "100" })).toBeNull();
    expect(readFrameMessage({ type: "preview:height", height: Number.POSITIVE_INFINITY })).toBeNull();
    expect(readFrameMessage({ type: "preview:shown" })).toBeNull();
    expect(readFrameMessage({ type: "preview:problem", id: 1, problem: 5 })).toBeNull();
    expect(readFrameMessage({ type: "preview:show", request: {} })).toBeNull();
  });
});
