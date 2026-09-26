import { describe, expect, it } from "vitest";
import type { ReportExportRow } from "@/lib/requests/queries";
import {
  receiptsZipFileName,
  REPORT_CSV_HEADER,
  reportCsv,
  reportCsvRow,
  reportFileName,
  SUMMARY_CSV_HEADER,
  summaryCsv,
  summaryFileName,
} from "./export";

const PAID: ReportExportRow = {
  request_number: 12,
  status: "paid",
  type: "youth",
  amount_cents: 4599,
  purchase_date: "2026-08-14",
  vendor: "Example Mart",
  description: "Snacks, drinks, and plates",
  event_name: "Summer kickoff",
  submitted_at: "2026-08-15T17:00:00+00:00",
  external_approver: null,
  approved_at: "2026-08-16T19:30:00+00:00",
  paid_at: "2026-09-26T06:30:00+00:00",
  payment_method: "bank_transfer",
  payment_reference: "TEST-001",
  no_receipt_reason: null,
  payee: { full_name: "Test Payee" },
  entered_by: { full_name: "Test Admin" },
  approver: { full_name: "Test Admin" },
  payer: { full_name: "Test Admin" },
  receipts: [{ count: 2 }],
};

const DRAFT: ReportExportRow = {
  ...PAID,
  request_number: 3,
  status: "draft",
  type: "cafe",
  amount_cents: 500,
  description: "Coffee",
  event_name: null,
  submitted_at: null,
  approved_at: null,
  paid_at: null,
  payment_method: null,
  payment_reference: null,
  no_receipt_reason: "Lost it",
  approver: null,
  payer: null,
  receipts: [{ count: 0 }],
};

describe("reportCsvRow", () => {
  it("writes a paid request in header order, with LA times", () => {
    const row = reportCsvRow(PAID);
    expect(row).toHaveLength(REPORT_CSV_HEADER.length);
    expect(Object.fromEntries(REPORT_CSV_HEADER.map((name, i) => [name, row[i]]))).toEqual({
      request_number: "R-0012",
      status: "Paid",
      payee: "Test Payee",
      entered_by: "Test Admin",
      purchase_date: "2026-08-14",
      vendor: "Example Mart",
      type: "Youth",
      description: "Snacks, drinks, and plates",
      event: "Summer kickoff",
      amount: "45.99",
      submitted_at: "2026-08-15 10:00",
      approved_by: "Test Admin",
      external_approver: null,
      approved_at: "2026-08-16 12:30",
      paid_by: "Test Admin",
      paid_at: "2026-09-25 23:30",
      payment_method: "Bank transfer",
      payment_reference: "TEST-001",
      receipt_count: 2,
      no_receipt_reason: null,
    });
  });

  it("leaves out what a draft doesn't have yet", () => {
    const row = Object.fromEntries(REPORT_CSV_HEADER.map((name, i) => [name, reportCsvRow(DRAFT)[i]]));
    expect(row).toMatchObject({
      status: "Draft",
      type: "Cafe",
      amount: "5.00",
      event: null,
      submitted_at: null,
      approved_by: undefined,
      paid_by: undefined,
      paid_at: null,
      payment_method: null,
      receipt_count: 0,
      no_receipt_reason: "Lost it",
    });
  });

  it("counts no receipts when the count is missing", () => {
    expect(reportCsvRow({ ...DRAFT, receipts: [] }).at(-2)).toBe(0);
  });
});

describe("reportCsv", () => {
  it("writes the header and one line per request", () => {
    const lines = reportCsv([PAID, DRAFT]).split("\r\n");
    expect(lines[0]).toBe(`﻿${REPORT_CSV_HEADER.join(",")}`);
    expect(lines[1]).toBe(
      'R-0012,Paid,Test Payee,Test Admin,2026-08-14,Example Mart,Youth,"Snacks, drinks, and plates",Summer kickoff,45.99,2026-08-15 10:00,Test Admin,,2026-08-16 12:30,Test Admin,2026-09-25 23:30,Bank transfer,TEST-001,2,',
    );
    expect(lines[2]).toBe("R-0003,Draft,Test Payee,Test Admin,2026-08-14,Example Mart,Cafe,Coffee,,5.00,,,,,,,,,0,Lost it");
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe("");
  });

  it("is just the header for an empty report", () => {
    expect(reportCsv([])).toBe(`﻿${REPORT_CSV_HEADER.join(",")}\r\n`);
  });
});

describe("reportFileName", () => {
  const q3 = { kind: "quarter", year: 2026, quarter: 3 } as const;

  it("names the period", () => {
    expect(reportFileName({ period: q3, basis: "purchase", allStatuses: false })).toBe(
      "sbc-youth-reimbursements_2026-Q3.csv",
    );
    expect(
      reportFileName({ period: { kind: "custom", start: "2026-03-15", end: "2026-04-02" }, basis: "purchase", allStatuses: false }),
    ).toBe("sbc-youth-reimbursements_2026-03-15_to_2026-04-02.csv");
  });

  it("marks a paid-date or all-statuses report", () => {
    expect(reportFileName({ period: q3, basis: "paid", allStatuses: false })).toBe(
      "sbc-youth-reimbursements_2026-Q3_paid-date.csv",
    );
    expect(reportFileName({ period: q3, basis: "paid", allStatuses: true })).toBe(
      "sbc-youth-reimbursements_2026-Q3_paid-date.csv",
    );
    expect(reportFileName({ period: q3, basis: "purchase", allStatuses: true })).toBe(
      "sbc-youth-reimbursements_2026-Q3_all-statuses.csv",
    );
  });
});

describe("summaryCsv", () => {
  it("writes each payee's totals by type, biggest first, then everyone's", () => {
    const lines = summaryCsv([
      { payee_id: "p1", payee: { full_name: "Alex Example" }, type: "cafe", amount_cents: 500 },
      { payee_id: "p2", payee: { full_name: "Pat Example" }, type: "youth", amount_cents: 4599 },
      { payee_id: "p1", payee: { full_name: "Alex Example" }, type: "youth", amount_cents: 1000 },
    ]).split("\r\n");
    expect(lines).toEqual([
      "﻿payee,cafe_amount,cafe_count,youth_amount,youth_count,total_amount,total_count",
      "Pat Example,0.00,0,45.99,1,45.99,1",
      "Alex Example,5.00,1,10.00,1,15.00,2",
      "All payees,5.00,1,55.99,2,60.99,3",
      "",
    ]);
  });

  it("has only the totals line for an empty report", () => {
    expect(summaryCsv([])).toBe(`﻿${SUMMARY_CSV_HEADER.join(",")}\r\nAll payees,0.00,0,0.00,0,0.00,0\r\n`);
  });
});

describe("summaryFileName", () => {
  it("names the period and marks it as the summary", () => {
    const q3 = { kind: "quarter", year: 2026, quarter: 3 } as const;
    expect(summaryFileName({ period: q3, basis: "purchase", allStatuses: false })).toBe(
      "sbc-youth-reimbursements_2026-Q3_summary.csv",
    );
    expect(summaryFileName({ period: q3, basis: "paid", allStatuses: false })).toBe(
      "sbc-youth-reimbursements_2026-Q3_paid-date_summary.csv",
    );
  });
});

describe("receiptsZipFileName", () => {
  it("names the period and marks it as the receipts", () => {
    const march = { kind: "month", year: 2026, month: 3 } as const;
    expect(receiptsZipFileName({ period: march, basis: "purchase", allStatuses: true })).toBe(
      "sbc-youth-reimbursements_2026-03_all-statuses_receipts.zip",
    );
  });
});
