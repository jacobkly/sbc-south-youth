import { describe, expect, it } from "vitest";
import {
  changeText,
  checkHeadcount,
  countedHint,
  lastFriday,
  latestText,
  planSave,
  savedMessage,
  suggestedNight,
  summarize,
  type Headcount,
} from "./headcount";

// A Tuesday. The Friday before it is Oct 2.
const TODAY = "2026-10-06";

function count(night: string, total: number): Headcount {
  return { id: `id-${night}`, night, total };
}

describe("checkHeadcount", () => {
  it("takes a past night and a whole number", () => {
    expect(checkHeadcount({ night: "2026-10-02", total: "45" }, TODAY)).toEqual({
      ok: true,
      headcount: { night: "2026-10-02", total: 45 },
    });
  });

  it("takes today, since the count is often typed that night", () => {
    expect(checkHeadcount({ night: TODAY, total: "30" }, TODAY).ok).toBe(true);
  });

  it("ignores spaces and a thousands comma", () => {
    expect(checkHeadcount({ night: "2026-10-02", total: " 1,000 " }, TODAY)).toEqual({
      ok: true,
      headcount: { night: "2026-10-02", total: 1000 },
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
      row: { night: "2026-10-02", total: 45 },
    });
  });

  it("writes a fix to the count or the night", () => {
    const existing = count("2026-10-02", 45);
    expect(planSave({ night: "2026-10-02", total: "47" }, existing, TODAY)).toEqual({
      kind: "write",
      row: { night: "2026-10-02", total: 47 },
    });
    expect(planSave({ night: "2026-10-03", total: "45" }, existing, TODAY)).toEqual({
      kind: "write",
      row: { night: "2026-10-03", total: 45 },
    });
  });

  it("writes nothing when nothing changed", () => {
    expect(planSave({ night: "2026-10-02", total: "45" }, count("2026-10-02", 45), TODAY)).toEqual({ kind: "same" });
  });

  it("passes on the form's problems", () => {
    expect(planSave({ night: "2026-10-02", total: "0" }, null, TODAY)).toEqual({
      kind: "invalid",
      errors: { total: "Enter at least 1." },
    });
  });
});

describe("savedMessage", () => {
  it("says what was saved for a new night", () => {
    expect(savedMessage({ night: "2026-10-02", total: 45 }, false, TODAY)).toBe("Saved 45 for Fri, Oct 2.");
  });

  it("says what the night is now after a fix", () => {
    expect(savedMessage({ night: "2026-10-02", total: 47 }, true, TODAY)).toBe("Fri, Oct 2 is now 47.");
  });

  it("names the year of a night from another year", () => {
    expect(savedMessage({ night: "2025-12-26", total: 30 }, false, TODAY)).toBe("Saved 30 for Fri, Dec 26, 2025.");
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
    });
  });

  it("has no change with only one night", () => {
    expect(summarize([count("2026-10-02", 45)])).toEqual({
      latest: count("2026-10-02", 45),
      change: null,
      average: { total: 45, nights: 1 },
      highest: count("2026-10-02", 45),
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
});

describe("changeText", () => {
  it("says how much the latest night went up or down from the one before", () => {
    expect(changeText({ from: count("2026-09-25", 40), by: 5 }, TODAY)).toBe("Up 5 from Fri, Sep 25");
    expect(changeText({ from: count("2026-09-25", 40), by: -4 }, TODAY)).toBe("Down 4 from Fri, Sep 25");
  });

  it("says when it's the same", () => {
    expect(changeText({ from: count("2026-09-25", 40), by: 0 }, TODAY)).toBe("Same as Fri, Sep 25");
  });

  it("says when there's nothing to compare with", () => {
    expect(changeText(null, TODAY)).toBe("The first night counted");
  });
});

describe("latestText", () => {
  it("gives the newest night's count", () => {
    expect(latestText([count("2026-09-25", 40), count("2026-10-02", 45)], TODAY)).toBe("45 on Fri, Oct 2");
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
