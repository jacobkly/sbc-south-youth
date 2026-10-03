import { FlagIcon, FlaskConicalIcon } from "lucide-react";
import { Badge } from "@/components/portal/ui/badge";
import { KIND_LABELS, OUTCOME_LABELS, STATUS_LABELS, type MessageRow } from "@/lib/portal/messages/list";

/**
 * A message's kind, with what else sets it apart: a takedown goes first,
 * a staging test isn't real, and a serve request may have an outcome.
 * `status` adds where it is, for the message's own page.
 */
export function MessageBadges({
  message,
  status = false,
}: {
  message: Pick<MessageRow, "kind" | "env" | "status" | "outcome">;
  status?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {message.kind === "takedown" ? (
        <Badge variant="destructive">
          <FlagIcon aria-hidden />
          Photo takedown
        </Badge>
      ) : (
        <Badge variant="secondary">{KIND_LABELS[message.kind]}</Badge>
      )}
      {status && <Badge variant={message.status === "new" ? "default" : "outline"}>{STATUS_LABELS[message.status]}</Badge>}
      {message.outcome && <Badge variant="outline">{OUTCOME_LABELS[message.outcome]}</Badge>}
      {message.env === "staging" && (
        <Badge variant="outline">
          <FlaskConicalIcon aria-hidden />
          Staging test
        </Badge>
      )}
    </div>
  );
}
