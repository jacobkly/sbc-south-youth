import { describe, expect, it } from "vitest";
import {
  addTagId,
  findTag,
  requestTagsErrorMessage,
  sameTagIds,
  sortTags,
  tagMatches,
  tagNameError,
  tagSaveErrorMessage,
  tagsOf,
  tidyTagName,
  toggleTagId,
} from "./tags";

const retreat = { id: "t1", name: "Test Retreat" };
const van = { id: "t2", name: "van" };
const kickoff = { id: "t3", name: "Kickoff" };

describe("tidyTagName", () => {
  it("trims and collapses spaces, the way the database saves it", () => {
    expect(tidyTagName("  Fall \t  retreat ")).toBe("Fall retreat");
  });
});

describe("tagNameError", () => {
  it("asks for a name when it's blank", () => {
    expect(tagNameError("   ")).toBe("Enter a name.");
  });

  it("keeps names to 50 characters, counted after tidying", () => {
    expect(tagNameError("t".repeat(51))).toBe("Keep the name to 50 characters or fewer.");
    expect(tagNameError(` ${"t".repeat(50)} `)).toBeNull();
  });
});

describe("sortTags", () => {
  it("sorts by name without regard to case, leaving the input alone", () => {
    const tags = [retreat, van, kickoff];
    expect(sortTags(tags).map((tag) => tag.name)).toEqual(["Kickoff", "Test Retreat", "van"]);
    expect(tags[0]).toBe(retreat);
  });
});

describe("tagsOf", () => {
  it("flattens a request's tags, sorted, skipping any it can't read", () => {
    expect(tagsOf([{ tag: van }, { tag: null }, { tag: retreat }])).toEqual([retreat, van]);
  });

  it("is empty for a request without tags", () => {
    expect(tagsOf([])).toEqual([]);
    expect(tagsOf(null)).toEqual([]);
  });
});

describe("tagMatches", () => {
  it("matches part of the name without regard to case or extra spaces", () => {
    expect(tagMatches(retreat, "  RETR ")).toBe(true);
    expect(tagMatches(retreat, "test   retreat")).toBe(true);
    expect(tagMatches(retreat, "van")).toBe(false);
  });

  it("matches everything for an empty search", () => {
    expect(tagMatches(retreat, "  ")).toBe(true);
  });
});

describe("findTag", () => {
  it("finds the tag a typed name would collide with", () => {
    expect(findTag([retreat, van], "  test  RETREAT ")).toBe(retreat);
    expect(findTag([retreat, van], "Retreat")).toBeUndefined();
  });
});

describe("toggleTagId", () => {
  it("adds a tag that isn't picked and takes off one that is", () => {
    expect(toggleTagId(["t1"], "t2")).toEqual(["t1", "t2"]);
    expect(toggleTagId(["t1", "t2"], "t1")).toEqual(["t2"]);
  });

  it("adds nothing past 10", () => {
    const ten = Array.from({ length: 10 }, (_, i) => `t${i}`);
    expect(toggleTagId(ten, "t99")).toBe(ten);
    expect(toggleTagId(ten, "t3")).toHaveLength(9);
  });
});

describe("addTagId", () => {
  it("adds a tag once, and nothing past 10", () => {
    expect(addTagId(["t1"], "t1")).toEqual(["t1"]);
    expect(addTagId(["t1"], "t2")).toEqual(["t1", "t2"]);
    const ten = Array.from({ length: 10 }, (_, i) => `t${i}`);
    expect(addTagId(ten, "t99")).toBe(ten);
  });
});

describe("tagSaveErrorMessage", () => {
  it("shows the database's own sentence for a duplicate or a bad name", () => {
    expect(tagSaveErrorMessage({ code: "23505", message: "There's already a tag called Van." })).toBe(
      "There's already a tag called Van.",
    );
    expect(tagSaveErrorMessage({ code: "22001", message: "Keep the name to 50 characters or fewer." })).toBe(
      "Keep the name to 50 characters or fewer.",
    );
  });

  it("explains a missing permission, like two-step sign-in", () => {
    expect(tagSaveErrorMessage({ code: "42501", message: "new row violates row-level security policy" })).toBe(
      "Only an owner can change tags.",
    );
  });

  it("never shows a raw database error", () => {
    expect(tagSaveErrorMessage({ code: "XX000", message: "internal error" })).toBe(
      "Couldn't save the tag. Check your connection and try again.",
    );
    expect(tagSaveErrorMessage(null)).toBe("Couldn't save the tag. Check your connection and try again.");
  });
});

describe("requestTagsErrorMessage", () => {
  it("shows the database's own sentence for a deleted tag or too many", () => {
    expect(requestTagsErrorMessage({ code: "P0002", message: "That tag was deleted. Reload and try again." })).toBe(
      "That tag was deleted. Reload and try again.",
    );
    expect(requestTagsErrorMessage({ code: "22023", message: "A request can have at most 10 tags." })).toBe(
      "A request can have at most 10 tags.",
    );
  });

  it("explains a missing permission", () => {
    expect(requestTagsErrorMessage({ code: "42501", message: "permission denied" })).toBe(
      "Only an owner can change tags.",
    );
  });

  it("never shows a raw database error", () => {
    expect(requestTagsErrorMessage({ code: "XX000", message: "internal error" })).toBe(
      "Couldn't save the tags. Check your connection and try again.",
    );
  });
});

describe("sameTagIds", () => {
  it("ignores order", () => {
    expect(sameTagIds(["t1", "t2"], ["t2", "t1"])).toBe(true);
  });

  it("notices a tag added or taken off", () => {
    expect(sameTagIds(["t1"], ["t1", "t2"])).toBe(false);
    expect(sameTagIds(["t1", "t2"], ["t1", "t3"])).toBe(false);
    expect(sameTagIds([], [])).toBe(true);
  });
});
