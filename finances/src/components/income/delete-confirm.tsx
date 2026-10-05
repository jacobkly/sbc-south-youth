"use client";

import { useState } from "react";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { incomeDeleteErrorMessage } from "@/lib/income/schema";
import { createClient } from "@/lib/supabase/client";

/** Go back or delete, for a youth entry or a cafe week. The sheet's title asks the question. */
export function DeleteConfirm({
  table,
  id,
  onBack,
  onDeleted,
}: {
  table: "youth_income" | "cafe_weeks";
  id: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    setPending(true);
    // An entry someone else already deleted is gone either way, so no rows back isn't an error.
    const { error: deleteError } = await createClient().from(table).delete().eq("id", id);
    if (deleteError) {
      setPending(false);
      setError(incomeDeleteErrorMessage(deleteError));
      return;
    }
    onDeleted();
  }

  return (
    <div className="space-y-4 px-4">
      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Couldn&apos;t delete it</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* "Go back" comes first so it gets focus, but it shows below on phones. */}
      <div className="flex flex-col-reverse gap-2 pt-2 desktop:flex-row desktop:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-11 desktop:min-w-28"
          disabled={pending}
          onClick={onBack}
          autoFocus
        >
          Go back
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="h-11 desktop:min-w-28"
          disabled={pending}
          onClick={() => void remove()}
        >
          {pending ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </div>
  );
}
