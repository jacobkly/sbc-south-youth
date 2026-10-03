import { describe, expect, it } from "vitest";
import { answersOf, readAnswers } from "./answers";

describe("answersOf", () => {
  it("labels each answer the way the form showed it", () => {
    expect(answersOf({ role: "parent" })).toEqual([["Who", "Parent or guardian"]]);
    expect(answersOf({ band: "hs" })).toEqual([["School", "In high school"]]);
    expect(answersOf({ areas: ["media", "worship"] })).toEqual([["Serve in", "Media, Worship"]]);
  });

  it("shows a choice the form no longer has as it was saved", () => {
    expect(answersOf({ role: "coach", areas: ["parking"] })).toEqual([
      ["Who", "coach"],
      ["Serve in", "parking"],
    ]);
  });

  it("shows nothing for a form that asks nothing extra", () => {
    expect(answersOf({})).toEqual([]);
  });
});

describe("readAnswers", () => {
  it("keeps the answers a message saved", () => {
    expect(readAnswers({ role: "student", areas: ["media"] })).toEqual({ role: "student", areas: ["media"] });
  });

  it("drops anything that isn't an answer, so a stray value never shows", () => {
    expect(readAnswers({ role: 5, band: "hs", areas: "media", extra: "x" })).toEqual({ band: "hs" });
    expect(readAnswers(null)).toEqual({});
    expect(readAnswers(["hs"])).toEqual({});
  });
});
