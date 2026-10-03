import { describe, expect, it } from "vitest";
import { emailAlert, emailOverview, parseEmailSummary, templateLabel, type EmailSummary } from "./summary";

function summary(overrides: Partial<EmailSummary> = {}): EmailSummary {
  return { day: 0, month: 0, templates: [], warned_at: null, ...overrides };
}

describe("parseEmailSummary", () => {
  it("accepts what email_summary() returns", () => {
    const data = {
      day: 3,
      month: 41,
      templates: [{ template: "invite", status: "sent", counted: true, emails: 3 }],
      warned_at: "2026-10-02T14:55:00.123456+00:00",
    };
    expect(parseEmailSummary(data)).toEqual(data);
  });

  it("throws rather than show wrong numbers", () => {
    expect(() => parseEmailSummary({ day: -1, month: 0, templates: [], warned_at: null })).toThrow();
    const partial = { day: 1, month: 1, templates: [{ template: "invite" }], warned_at: null };
    expect(() => parseEmailSummary(partial)).toThrow();
    expect(() => parseEmailSummary(null)).toThrow();
  });
});

describe("emailOverview", () => {
  it("counts today out of 100 and the month out of 3,000", () => {
    const { day, month } = emailOverview(summary({ day: 12, month: 450 }));
    expect(day).toEqual({ used: 12, limit: 100, percent: 12, level: "ok", full: false });
    expect(month).toEqual({ used: 450, limit: 3000, percent: 15, level: "ok", full: false });
  });

  it("turns amber at 80% and red at 95%", () => {
    expect(emailOverview(summary({ month: 2399 })).month.level).toBe("ok");
    expect(emailOverview(summary({ month: 2400 })).month.level).toBe("warning");
    expect(emailOverview(summary({ month: 2850 })).month.level).toBe("critical");
    expect(emailOverview(summary({ day: 80 })).day.level).toBe("warning");
    expect(emailOverview(summary({ day: 95 })).day.level).toBe("critical");
  });

  it("is full at the limit, and can pass it when Resend took more than the count expected", () => {
    const { day, month } = emailOverview(summary({ day: 104, month: 3000 }));
    expect(day).toMatchObject({ percent: 104, full: true });
    expect(month).toMatchObject({ percent: 100, full: true });
  });

  describe("what the quota holds back", () => {
    it("holds back nothing below 80 in a day and 2,900 in a month", () => {
      expect(emailOverview(summary({ day: 79, month: 2899 })).note).toBeNull();
    });

    it("skips finance emails and form alerts from 80 in a day", () => {
      expect(emailOverview(summary({ day: 80 })).note).toEqual({
        level: "warning",
        text:
          "Finance emails and form alerts are skipped for now, to keep room for sign-in codes, invites and the " +
          "digest. They send again once the last 24 hours drop below 80.",
      });
    });

    it("skips invites and owner alerts too from 90, and keeps the digest until 100", () => {
      expect(emailOverview(summary({ day: 90 })).note).toEqual({
        level: "warning",
        text:
          "Only sign-in codes and the daily digest send for now. Invites and owner alerts send again once the " +
          "last 24 hours drop below 90, and everything else below 80.",
      });
    });

    it("skips everything but sign-in codes from 2,900 in a month", () => {
      expect(emailOverview(summary({ day: 85, month: 2900 })).note).toEqual({
        level: "critical",
        text: "Only sign-in codes send for now. Everything else sends again once the last 31 days drop below 2,900.",
      });
    });

    it("says sign-in codes may fail once Resend's own limits are reached", () => {
      expect(emailOverview(summary({ day: 100, month: 1200 })).note).toEqual({
        level: "critical",
        text:
          "Resend's daily limit is reached, so nothing sends and sign-in codes may fail. Sending picks up as the " +
          "last 24 hours drop below 100.",
      });
      expect(emailOverview(summary({ day: 100, month: 3000 })).note).toEqual({
        level: "critical",
        text:
          "Resend's monthly limit is reached, so nothing sends and sign-in codes may fail. Sending picks up as " +
          "the last 31 days drop below 3,000.",
      });
    });
  });

  describe("templates", () => {
    it("lists each template by what was sent, with the problems beside it, busiest first", () => {
      const { templates } = emailOverview(
        summary({
          templates: [
            { template: "auth", status: "bounced", counted: true, emails: 1 },
            { template: "auth", status: "delivered", counted: true, emails: 4 },
            { template: "form-alert", status: "skipped_quota", counted: false, emails: 3 },
            { template: "form-alert", status: "failed", counted: false, emails: 2 },
            { template: "form-alert", status: "failed", counted: true, emails: 1 },
            { template: "form-alert", status: "delivered", counted: true, emails: 4 },
            { template: "invite", status: "delivered", counted: true, emails: 30 },
          ],
        }),
      );

      expect(templates).toEqual([
        { template: "invite", label: "Invites", sent: 30, problems: [] },
        {
          template: "form-alert",
          label: "Form alerts",
          sent: 5,
          problems: [
            { status: "failed", label: "Failed", emails: 3 },
            { status: "skipped_quota", label: "Skipped for the limit", emails: 3 },
          ],
        },
        {
          template: "auth",
          label: "Sign-in codes",
          sent: 5,
          problems: [{ status: "bounced", label: "Bounced", emails: 1 }],
        },
      ]);
    });

    it("counts queued and blocked emails as neither sent nor a problem", () => {
      const { templates } = emailOverview(
        summary({
          templates: [
            { template: "daily-digest", status: "queued", counted: true, emails: 1 },
            { template: "daily-digest", status: "suppressed", counted: false, emails: 2 },
          ],
        }),
      );
      expect(templates).toEqual([{ template: "daily-digest", label: "Daily digest", sent: 1, problems: [] }]);
    });

    it("orders problems by how serious they are", () => {
      const { templates } = emailOverview(
        summary({
          templates: [
            { template: "invite", status: "skipped_quota", counted: false, emails: 1 },
            { template: "invite", status: "failed", counted: false, emails: 1 },
            { template: "invite", status: "bounced", counted: true, emails: 1 },
            { template: "invite", status: "complained", counted: true, emails: 1 },
          ],
        }),
      );
      expect(templates[0].problems.map((problem) => problem.label)).toEqual([
        "Marked as spam",
        "Bounced",
        "Failed",
        "Skipped for the limit",
      ]);
    });
  });

  it("passes on when owners were warned this month", () => {
    expect(emailOverview(summary()).warnedAt).toBeNull();
    expect(emailOverview(summary({ warned_at: "2026-10-02T14:55:00+00:00" })).warnedAt).toBe(
      "2026-10-02T14:55:00+00:00",
    );
  });
});

describe("templateLabel", () => {
  it("names every template the apps send", () => {
    expect(
      [
        "auth",
        "invite",
        "access",
        "owner-changed",
        "request-submitted",
        "request-returned",
        "request-paid",
        "form-alert",
        "daily-digest",
        "quota-warning",
      ].map(templateLabel),
    ).toEqual([
      "Sign-in codes",
      "Invites",
      "New access",
      "Owner changes",
      "Requests to review",
      "Requests sent back",
      "Requests paid",
      "Form alerts",
      "Daily digest",
      "Quota warnings",
    ]);
  });

  it("shows a template it doesn't know by its name", () => {
    expect(templateLabel("new-thing")).toBe("new-thing");
  });
});

describe("emailAlert", () => {
  it("stays quiet below 80% of both limits", () => {
    expect(emailAlert(emailOverview(summary({ day: 79, month: 2399 })))).toBeNull();
  });

  it("warns before the month starts skipping anything", () => {
    expect(emailAlert(emailOverview(summary({ day: 10, month: 2460 })))).toEqual({
      level: "warning",
      title: "82% of this month's email is used",
      text: "Once the last 31 days reach 2,900, only sign-in codes send.",
    });
  });

  it("says what's being skipped once a limit holds emails back", () => {
    expect(emailAlert(emailOverview(summary({ day: 86, month: 900 })))).toEqual({
      level: "warning",
      title: "86% of today's email is used",
      text:
        "Finance emails and form alerts are skipped for now, to keep room for sign-in codes, invites and the " +
        "digest. They send again once the last 24 hours drop below 80.",
    });
  });

  it("names whichever limit is fuller, and turns red when either is", () => {
    expect(emailAlert(emailOverview(summary({ day: 84, month: 2910 })))).toMatchObject({
      level: "critical",
      title: "97% of this month's email is used",
    });
    expect(emailAlert(emailOverview(summary({ day: 96, month: 2500 })))).toMatchObject({
      level: "critical",
      title: "96% of today's email is used",
    });
  });
});
