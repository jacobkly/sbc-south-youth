import type { ChartConfig } from "@/components/ui/chart";
import { REQUEST_TYPE_LABELS } from "@/lib/requests/format";

/** Series colors for cafe and youth, shared by every dashboard chart. */
export const TYPE_CHART_CONFIG = {
  cafe: { label: REQUEST_TYPE_LABELS.cafe, color: "var(--chart-1)" },
  youth: { label: REQUEST_TYPE_LABELS.youth, color: "var(--chart-2)" },
} satisfies ChartConfig;
