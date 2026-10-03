import { CalendarXIcon, HouseIcon, PinIcon } from "lucide-react";
import { Badge } from "@/components/portal/ui/badge";
import type { PostRow } from "@/lib/portal/posts/list";

/** What sets a heads-up apart: on Home now, a change of plans, or pinned. */
export function PostBadges({ post, onHome = false }: { post: Pick<PostRow, "tone" | "pinned">; onHome?: boolean }) {
  if (!onHome && post.tone !== "cancellation" && !post.pinned) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {onHome && (
        <Badge>
          <HouseIcon aria-hidden />
          On Home
        </Badge>
      )}
      {post.tone === "cancellation" && (
        <Badge variant="destructive">
          <CalendarXIcon aria-hidden />
          Change of plans
        </Badge>
      )}
      {post.pinned && (
        <Badge variant="secondary">
          <PinIcon aria-hidden />
          Pinned
        </Badge>
      )}
    </div>
  );
}
