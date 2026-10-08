import type { ChartConfig } from "@/components/ui/chart";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";

/** Series colors for cafe and youth, shared by every dashboard chart. */
export const TYPE_CHART_CONFIG = {
  cafe: { label: REQUEST_TYPE_LABELS.cafe, color: "var(--chart-1)" },
  youth: { label: REQUEST_TYPE_LABELS.youth, color: "var(--chart-2)" },
} satisfies ChartConfig;

export const IN_OUT_SERIES = ["in", "out"] as const;
export type InOutSeries = (typeof IN_OUT_SERIES)[number];

/** Money in and paid out. Neutral colors, so neither reads as cafe or youth. */
export const IN_OUT_CHART_CONFIG = {
  in: { label: "Money in", color: "var(--primary)" },
  out: { label: "Paid out", color: "var(--chart-3)" },
} satisfies Record<InOutSeries, ChartConfig[string]>;
