"use client";

import { useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRightIcon, CircleAlertIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { describedBy, FormField } from "@/components/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCents } from "@/lib/money";
import { DEFAULT_QUEUE_FILTERS, queueHref } from "@/lib/requests/queue";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_TAG_NAME,
  TAG_COLUMNS,
  tagDeleteErrorMessage,
  tagNameError,
  tagSaveErrorMessage,
  tidyTagName,
  type TagRow,
} from "@/lib/tags/tags";
import { removesFromText, type TagStats } from "@/lib/tags/totals";
import { cn } from "@/lib/utils";

const NO_REQUESTS: TagStats = { count: 0, totalCents: 0 };

/**
 * Every tag with its count and total over all time. Tapping one opens the
 * request list filtered to it. Owners rename and delete tags from here.
 */
export function TagManager({
  tags,
  stats,
  canEdit,
}: {
  /** Sorted by name. */
  tags: TagRow[];
  /** By tag id. A tag on no requests is left out. */
  stats: Record<string, TagStats>;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<TagRow | null>(null);

  if (tags.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        <p>No tags yet.</p>
        {canEdit && <p className="mt-1">Add one from a request&apos;s Tags field.</p>}
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y rounded-lg border">
        {tags.map((tag) => {
          const { count, totalCents } = stats[tag.id] ?? NO_REQUESTS;
          return (
            <li key={tag.id} className="flex items-center">
              <Link
                href={queueHref({ ...DEFAULT_QUEUE_FILTERS, tab: "all", tag: tag.id })}
                className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{tag.name}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {count === 0 ? "No requests" : `${count.toLocaleString()} ${count === 1 ? "request" : "requests"}`}
                  </p>
                </div>
                <span
                  className={cn("shrink-0 text-right text-sm tabular-nums", totalCents === 0 && "text-muted-foreground")}
                >
                  {formatCents(totalCents)}
                  <span className="sr-only"> approved and paid</span>
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="mr-1 size-11 shrink-0 text-muted-foreground"
                  aria-label={`Rename or delete ${tag.name}`}
                  onClick={() => setEditing(tag)}
                >
                  <PencilIcon />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {canEdit && (
        <TagSheet
          tag={editing}
          count={editing ? (stats[editing.id] ?? NO_REQUESTS).count : 0}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

/** Rename a tag, or delete it behind a confirm that says how many requests lose it. */
function TagSheet({ tag, count, onClose }: { tag: TagRow | null; count: number; onClose: () => void }) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const open = tag !== null;
  // Keep showing the last tag while the sheet animates closed.
  const [shown, setShown] = useState({ tag, count });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setConfirmingDelete(false);
  }
  if (tag && tag !== shown.tag) setShown({ tag, count });
  const current = shown.tag;

  function done() {
    onClose();
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <ResponsiveSheetContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          nameRef.current?.focus();
        }}
      >
        <SheetHeader className="pr-12">
          <SheetTitle className="break-words">
            {confirmingDelete && current ? <>Delete &ldquo;{current.name}&rdquo;?</> : "Edit tag"}
          </SheetTitle>
          <SheetDescription>
            {confirmingDelete
              ? `${removesFromText(shown.count)} This can't be undone.`
              : "A new name shows on every request with this tag."}
          </SheetDescription>
        </SheetHeader>
        {current &&
          (confirmingDelete ? (
            <DeleteTag id={current.id} onBack={() => setConfirmingDelete(false)} onDeleted={done} />
          ) : (
            <RenameTag
              key={current.id}
              tag={current}
              nameRef={nameRef}
              onSaved={done}
              onUnchanged={onClose}
              onDelete={() => setConfirmingDelete(true)}
            />
          ))}
      </ResponsiveSheetContent>
    </Sheet>
  );
}

const NAME_ID = "tag-name";

function RenameTag({
  tag,
  nameRef,
  onSaved,
  onUnchanged,
  onDelete,
}: {
  tag: TagRow;
  nameRef: RefObject<HTMLInputElement | null>;
  onSaved: () => void;
  onUnchanged: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    const problem = tagNameError(name);
    if (problem) {
      setError(problem);
      nameRef.current?.focus();
      return;
    }
    const tidy = tidyTagName(name);
    if (tidy === tag.name) {
      onUnchanged();
      return;
    }

    setFormError(null);
    setPending(true);
    const { error: saveError } = await createClient()
      .from("tags")
      .update({ name: tidy })
      .eq("id", tag.id)
      .select(TAG_COLUMNS)
      .single();

    if (saveError) {
      setPending(false);
      // A duplicate name belongs under the field. Anything else goes on top.
      if (saveError.code === "23505") {
        setError(tagSaveErrorMessage(saveError));
        nameRef.current?.focus();
      } else {
        setFormError(tagSaveErrorMessage(saveError));
      }
      return;
    }
    // Stays pending while the sheet closes and the list reloads.
    onSaved();
  }

  return (
    <form
      noValidate
      className="space-y-4 px-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {formError && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <FormField id={NAME_ID} label="Name" error={error ?? undefined}>
        <Input
          ref={nameRef}
          id={NAME_ID}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(NAME_ID, error ?? undefined)}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          maxLength={MAX_TAG_NAME}
          className="h-11"
        />
      </FormField>

      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={pending}
        onClick={onDelete}
      >
        <Trash2Icon aria-hidden />
        Delete tag
      </Button>
    </form>
  );
}

function DeleteTag({ id, onBack, onDeleted }: { id: string; onBack: () => void; onDeleted: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    setPending(true);
    // A tag someone else already deleted is gone either way, so no rows back isn't an error.
    const { error: deleteError } = await createClient().from("tags").delete().eq("id", id);
    if (deleteError) {
      setPending(false);
      setError(tagDeleteErrorMessage(deleteError));
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
