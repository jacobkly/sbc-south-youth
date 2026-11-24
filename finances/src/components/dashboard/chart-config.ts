import type { ChartConfig } from "@/components/ui/chart";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";

/** Series colors for cafe and youth, shared by every dashboard chart. */
export const TYPE_CHART_CONFIG = {
  cafe: { label: REQUEST_TYPE_LABELS.cafe, color: "var(--chart-1)" },
  youth: { label: REQUEST_TYPE_LABELS.youth, color: "var(--chart-2)" },
} satisfies ChartConfig;

export const MONEY_SERIES = ["income", "expenses"] as const;
export type MoneySeries = (typeof MONEY_SERIES)[number];

/** Income and expenses. Neutral colors, so neither reads as cafe or youth. */
export const MONEY_CHART_CONFIG = {
  income: { label: "Income", color: "var(--primary)" },
  expenses: { label: "Expenses", color: "var(--chart-3)" },
} satisfies Record<MoneySeries, ChartConfig[string]>;
