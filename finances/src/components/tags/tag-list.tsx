import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import type { TagRow } from "@/lib/tags/tags";

/** A request's tags as small badges that wrap. Long names are cut short. */
export function TagList({ tags, className }: { tags: readonly TagRow[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1", className)} aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag.id} className="min-w-0">
          <Badge variant="secondary" className="max-w-full">
            <span className="truncate">{tag.name}</span>
          </Badge>
        </li>
      ))}
    </ul>
  );
}
