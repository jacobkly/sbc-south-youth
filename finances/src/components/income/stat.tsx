import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** One number in a month's summary, with a line about it. */
export function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card size="sm" className="min-w-0 gap-2">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="truncate text-xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="truncate text-xs text-muted-foreground">{note}</CardContent>
    </Card>
  );
}
