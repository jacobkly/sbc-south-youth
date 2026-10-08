export const INCOME_TABS = ["youth", "cafe"] as const;
export type IncomeTab = (typeof INCOME_TABS)[number];

type SearchParams = Record<string, string | string[] | undefined>;

/** Which tab the Income page opens on, from the URL. Anything unrecognized opens Youth. */
export function parseIncomeTab(params: SearchParams): IncomeTab {
  const value = params.tab;
  const tab = Array.isArray(value) ? value[0] : value;
  return INCOME_TABS.find((candidate) => candidate === tab) ?? "youth";
}

/** The Income page's URL for a tab, leaving out the default. */
export function incomeHref(tab: IncomeTab): string {
  return tab === "youth" ? "/admin/income" : `/admin/income?tab=${tab}`;
}
