import { describe, expect, it } from "vitest";
import {
  changeText,
  checkHeadcount,
  countedHint,
  lastFriday,
  latestText,
  leftOutText,
  planSave,
  savedMessage,
  suggestedNight,
  summarize,
  type Headcount,
} from "./headcount";

// A Tuesday. The Friday before it is Oct 2.
const TODAY = "2026-10-06";

function count(night: string, total: number, extra: Partial<Headcount> = {}): Headcount {
  return { id: `id-${night}`, night, total, note: null, combined: false, ...extra };
}

/** A night another group joined. */
function combined(night: string, total: number): Headcount {
  return count(night, total, { combined: true });
}

describe("checkHeadcount", () => {
  it("takes a past night and a whole number", () => {
    expect(checkHeadcount({ night: "2026-10-02", total: "45" }, TODAY)).toEqual({
      ok: true,
      headcount: { night: "2026-10-02", total: 45, note: null, combined: false },
    });
  });

  it("takes today, since the count is often typed that night", () => {
    expect(checkHeadcount({ night: TODAY, total: "30" }, TODAY).ok).toBe(true);
  });

  it("ignores spaces and a thousands comma", () => {
    expect(checkHeadcount({ night: "2026-10-02", total: " 1,000 " }, TODAY)).toEqual({
      ok: true,
      headcount: { night: "2026-10-02", total: 1000, note: null, combined: false },
    });
  });

  it("asks for the night when it's blank or not a real date", () => {
    expect(checkHeadcount({ night: "", total: "45" }, TODAY)).toEqual({
      ok: false,
      errors: { night: "Pick the night." },
    });
    expect(checkHeadcount({ night: "2026-02-30", total: "45" }, TODAY)).toEqual({
      ok: false,
      errors: { night: "Pick the night." },
    });
  });

  it("turns away a night that hasn't happened yet", () => {
    expect(checkHeadcount({ night: "2026-10-09", total: "45" }, TODAY)).toEqual({
      ok: false,
      errors: { night: "Pick a night that's already happened." },
    });
  });

  it("asks for the count when it's blank", () => {
    expect(checkHeadcount({ night: "2026-10-02", total: "  " }, TODAY)).toEqual({
      ok: false,
      errors: { total: "Enter how many came." },
    });
  });

  it.each(["4.5", "-3", "forty", "4 5"])("turns away %s as not a whole number", (total) => {
    expect(checkHeadcount({ night: "2026-10-02", total }, TODAY)).toEqual({
      ok: false,
      errors: { total: "Enter a whole number, like 42." },
    });
  });

  it("needs at least 1", () => {
    expect(checkHeadcount({ night: "2026-10-02", total: "0" }, TODAY)).toEqual({
      ok: false,
      errors: { total: "Enter at least 1." },
    });
  });

  it("stops at 1,000, the database's limit", () => {
    expect(checkHeadcount({ night: "2026-10-02", total: "1001" }, TODAY)).toEqual({
      ok: false,
      errors: { total: "That's more than 1,000. Check the number." },
    });
  });

  it("takes a note, trimmed, and the combined mark", () => {
    const values = { night: "2026-10-02", total: "120", note: "  Joint night with another group ", combined: true };
    expect(checkHeadcount(values, TODAY)).toEqual({
      ok: true,
      headcount: { night: "2026-10-02", total: 120, note: "Joint night with another group", combined: true },
    });
  });

  it("leaves a blank note empty", () => {
    const check = checkHeadcount({ night: "2026-10-02", total: "45", note: "   " }, TODAY);
    expect(check.ok && check.headcount.note).toBeNull();
  });

  it("stops a note at 200 characters, the database's limit", () => {
    expect(checkHeadcount({ night: "2026-10-02", total: "45", note: "a".repeat(200) }, TODAY).ok).toBe(true);
    expect(checkHeadcount({ night: "2026-10-02", total: "45", note: "a".repeat(201) }, TODAY)).toEqual({
      ok: false,
      errors: { note: "Keep the note to 200 characters. This one has 201." },
    });
  });

  it("counts only a real true as combined", () => {
    const check = checkHeadcount({ night: "2026-10-02", total: "45", combined: "true" }, TODAY);
    expect(check.ok && check.headcount.combined).toBe(false);
  });

  it("reports both fields at once", () => {
    expect(checkHeadcount({ night: "", total: "" }, TODAY)).toEqual({
      ok: false,
      errors: { night: "Pick the night.", total: "Enter how many came." },
    });
  });

  it("treats anything that isn't the form's fields as blank", () => {
    expect(checkHeadcount(null, TODAY)).toEqual({
      ok: false,
      errors: { night: "Pick the night.", total: "Enter how many came." },
    });
    expect(checkHeadcount({ night: 20261002, total: 45 }, TODAY)).toEqual({
      ok: false,
      errors: { night: "Pick the night.", total: "Enter how many came." },
    });
  });
});

describe("planSave", () => {
  it("writes a new night", () => {
    expect(planSave({ night: "2026-10-02", total: "45" }, null, TODAY)).toEqual({
      kind: "write",
      row: { night: "2026-10-02", total: 45, note: null, combined: false },
    });
  });

  it("writes a fix to the count or the night", () => {
    const existing = count("2026-10-02", 45);
    expect(planSave({ night: "2026-10-02", total: "47" }, existing, TODAY)).toEqual({
      kind: "write",
      row: { night: "2026-10-02", total: 47, note: null, combined: false },
    });
    expect(planSave({ night: "2026-10-03", total: "45" }, existing, TODAY)).toEqual({
      kind: "write",
      row: { night: "2026-10-03", total: 45, note: null, combined: false },
    });
  });

  it("writes a change to just the note or the mark", () => {
    const existing = count("2026-10-02", 45);
    expect(planSave({ night: "2026-10-02", total: "45", note: "Rainy night" }, existing, TODAY)).toEqual({
      kind: "write",
      row: { night: "2026-10-02", total: 45, note: "Rainy night", combined: false },
    });
    expect(planSave({ night: "2026-10-02", total: "45", combined: true }, existing, TODAY)).toEqual({
      kind: "write",
      row: { night: "2026-10-02", total: 45, note: null, combined: true },
    });
  });

  it("writes nothing when nothing changed", () => {
    expect(planSave({ night: "2026-10-02", total: "45" }, count("2026-10-02", 45), TODAY)).toEqual({ kind: "same" });
    const noted = count("2026-10-02", 120, { note: "Joint night", combined: true });
    const values = { night: "2026-10-02", total: "120", note: " Joint night ", combined: true };
    expect(planSave(values, noted, TODAY)).toEqual({ kind: "same" });
  });

  it("passes on the form's problems", () => {
    expect(planSave({ night: "2026-10-02", total: "0" }, null, TODAY)).toEqual({
      kind: "invalid",
      errors: { total: "Enter at least 1." },
    });
  });
});

describe("savedMessage", () => {
  const row = (night: string, total: number, isCombined = false) => ({ night, total, note: null, combined: isCombined });

  it("says what was saved for a new night", () => {
    expect(savedMessage(row("2026-10-02", 45), null, TODAY)).toBe("Saved 45 for Fri, Oct 2.");
  });

  it("calls a new combined night a combined event", () => {
    expect(savedMessage(row("2026-10-02", 120, true), null, TODAY)).toBe("Saved 120 for Fri, Oct 2, a combined event.");
  });

  it("says what the night is now after a fix to the count or the night", () => {
    expect(savedMessage(row("2026-10-02", 47), count("2026-10-02", 45), TODAY)).toBe("Fri, Oct 2 is now 47.");
    expect(savedMessage(row("2026-10-03", 45), count("2026-10-02", 45), TODAY)).toBe("Sat, Oct 3 is now 45.");
  });

  it("says the night was saved after a change to just the note or the mark", () => {
    expect(savedMessage(row("2026-10-02", 45, true), count("2026-10-02", 45), TODAY)).toBe("Saved Fri, Oct 2.");
  });

  it("names the year of a night from another year", () => {
    expect(savedMessage(row("2025-12-26", 30), null, TODAY)).toBe("Saved 30 for Fri, Dec 26, 2025.");
  });
});

describe("lastFriday", () => {
  it("goes back to the Friday before", () => {
    expect(lastFriday("2026-10-06")).toBe("2026-10-02");
    expect(lastFriday("2026-10-08")).toBe("2026-10-02");
    expect(lastFriday("2026-10-03")).toBe("2026-10-02");
  });

  it("is today on a Friday", () => {
    expect(lastFriday("2026-10-02")).toBe("2026-10-02");
  });

  it("crosses into the year before", () => {
    expect(lastFriday("2027-01-01")).toBe("2027-01-01");
    expect(lastFriday("2026-01-01")).toBe("2025-12-26");
  });
});

describe("suggestedNight", () => {
  it("starts on the latest Friday when it has no count yet", () => {
    expect(suggestedNight(TODAY, ["2026-09-25"])).toBe("2026-10-02");
  });

  it("goes back to the latest Friday that still needs one, so catching up is one save after another", () => {
    expect(suggestedNight(TODAY, ["2026-10-02", "2026-09-25"])).toBe("2026-09-18");
    expect(suggestedNight(TODAY, ["2026-10-02", "2026-09-18"])).toBe("2026-09-25");
  });

  it("looks back eight Fridays at most, then settles on the latest", () => {
    const seven = ["2026-10-02", "2026-09-25", "2026-09-18", "2026-09-11", "2026-09-04", "2026-08-28", "2026-08-21"];
    expect(suggestedNight(TODAY, seven)).toBe("2026-08-14");
    expect(suggestedNight(TODAY, [...seven, "2026-08-14"])).toBe("2026-10-02");
  });

  it("ignores counts on other nights of the week", () => {
    expect(suggestedNight(TODAY, ["2026-10-03"])).toBe("2026-10-02");
  });
});

describe("summarize", () => {
  it("is null with no counts", () => {
    expect(summarize([])).toBeNull();
  });

  it("gives the latest night, the change from the one before, the average, and the most", () => {
    const counts = [count("2026-09-18", 38), count("2026-10-02", 45), count("2026-09-25", 40)];
    expect(summarize(counts)).toEqual({
      latest: count("2026-10-02", 45),
      change: { from: count("2026-09-25", 40), by: 5 },
      average: { total: 41, nights: 3 },
      highest: count("2026-10-02", 45),
      combined: 0,
    });
  });

  it("has no change with only one night", () => {
    expect(summarize([count("2026-10-02", 45)])).toEqual({
      latest: count("2026-10-02", 45),
      change: null,
      average: { total: 45, nights: 1 },
      highest: count("2026-10-02", 45),
      combined: 0,
    });
  });

  it("averages only the latest eight nights, rounded", () => {
    const counts = [
      count("2026-08-07", 500),
      ...[14, 21, 28].map((day) => count(`2026-08-${day}`, 30)),
      ...["04", "11", "18", "25"].map((day) => count(`2026-09-${day}`, 31)),
      count("2026-10-02", 32),
    ];
    expect(summarize(counts)?.average).toEqual({ total: 31, nights: 8 });
  });

  it("names the latest of several nights tied for the most", () => {
    const counts = [count("2026-09-18", 45), count("2026-10-02", 40), count("2026-09-25", 45)];
    expect(summarize(counts)?.highest).toEqual(count("2026-09-25", 45));
  });

  it("counts a drop as a negative change", () => {
    expect(summarize([count("2026-09-25", 40), count("2026-10-02", 36)])?.change?.by).toBe(-4);
  });

  it("leaves combined events out of the average and the most", () => {
    const counts = [count("2026-09-18", 38), combined("2026-09-25", 150), count("2026-10-02", 42)];
    expect(summarize(counts)).toMatchObject({
      average: { total: 40, nights: 2 },
      highest: count("2026-10-02", 42),
      combined: 1,
    });
  });

  it("averages the latest eight regular nights, reaching past combined ones", () => {
    const counts = [
      count("2026-08-07", 22),
      ...[14, 21, 28].map((day) => count(`2026-08-${day}`, 30)),
      ...["04", "11", "18", "25"].map((day) => count(`2026-09-${day}`, 30)),
      combined("2026-10-02", 200),
    ];
    expect(summarize(counts)?.average).toEqual({ total: 29, nights: 8 });
  });

  it("compares a regular night with the regular night before it", () => {
    const counts = [count("2026-09-18", 38), combined("2026-09-25", 150), count("2026-10-02", 42)];
    expect(summarize(counts)?.change).toEqual({ from: count("2026-09-18", 38), by: 4 });
  });

  it("doesn't compare a combined event with anything", () => {
    const counts = [count("2026-09-25", 40), combined("2026-10-02", 150)];
    expect(summarize(counts)).toMatchObject({ latest: combined("2026-10-02", 150), change: null });
  });

  it("has no average or most when every night was combined", () => {
    expect(summarize([combined("2026-10-02", 150)])).toEqual({
      latest: combined("2026-10-02", 150),
      change: null,
      average: null,
      highest: null,
      combined: 1,
    });
  });
});

describe("changeText", () => {
  const summaryOf = (...counts: Headcount[]) => {
    const summary = summarize(counts);
    if (!summary) throw new Error("No counts");
    return summary;
  };

  it("says how much the latest night went up or down from the one before", () => {
    expect(changeText(summaryOf(count("2026-09-25", 40), count("2026-10-02", 45)), TODAY)).toBe(
      "Up 5 from Fri, Sep 25",
    );
    expect(changeText(summaryOf(count("2026-09-25", 40), count("2026-10-02", 36)), TODAY)).toBe(
      "Down 4 from Fri, Sep 25",
    );
  });

  it("says when it's the same", () => {
    expect(changeText(summaryOf(count("2026-09-25", 40), count("2026-10-02", 40)), TODAY)).toBe("Same as Fri, Sep 25");
  });

  it("says when there's nothing to compare with", () => {
    expect(changeText(summaryOf(count("2026-10-02", 45)), TODAY)).toBe("The first night counted");
  });

  it("calls a combined event what it is instead of comparing it", () => {
    expect(changeText(summaryOf(count("2026-09-25", 40), combined("2026-10-02", 150)), TODAY)).toBe(
      "A combined event",
    );
  });

  it("says when every night before it was combined", () => {
    expect(changeText(summaryOf(combined("2026-09-25", 150), count("2026-10-02", 40)), TODAY)).toBe(
      "No regular night before it",
    );
  });
});

describe("leftOutText", () => {
  it("says how many combined events the average and the most leave out", () => {
    expect(leftOutText(1)).toBe("Average and Most leave out 1 combined event.");
    expect(leftOutText(3)).toBe("Average and Most leave out 3 combined events.");
  });

  it("is null with none to leave out", () => {
    expect(leftOutText(0)).toBeNull();
  });
});

describe("latestText", () => {
  it("gives the newest night's count", () => {
    expect(latestText([count("2026-09-25", 40), count("2026-10-02", 45)], TODAY)).toBe("45 on Fri, Oct 2");
  });

  it("says when the newest night was a combined event", () => {
    expect(latestText([combined("2026-10-02", 150)], TODAY)).toBe("150 on Fri, Oct 2, a combined event");
  });

  it("says when nothing is counted yet", () => {
    expect(latestText([], TODAY)).toBe("No counts yet");
  });
});

describe("countedHint", () => {
  it("names the count a night already has", () => {
    expect(countedHint("2026-10-02", [count("2026-10-02", 45)], TODAY)).toBe(
      "Fri, Oct 2 already has 45. To change it, tap it in the list below.",
    );
  });

  it("is null for a night with no count", () => {
    expect(countedHint("2026-09-25", [count("2026-10-02", 45)], TODAY)).toBeNull();
    expect(countedHint("", [count("2026-10-02", 45)], TODAY)).toBeNull();
  });
});
