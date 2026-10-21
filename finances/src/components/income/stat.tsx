import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** One number in a month's summary, with a line about it. */
export function Stat({
  label,
  value,
  note,
  className,
}: {
  label: string;
  value: string;
  note: string;
  className?: string;
}) {
  return (
    <Card size="sm" className={cn("min-w-0 gap-2", className)}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="truncate text-xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="truncate text-xs text-muted-foreground">{note}</CardContent>
    </Card>
  );
}
