"use client";

import { useState, type KeyboardEvent } from "react";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import {
  addTagId,
  findTag,
  MAX_TAG_NAME,
  MAX_TAGS,
  TAG_COLUMNS,
  tagMatches,
  tagNameError,
  tagSaveErrorMessage,
  tidyTagName,
  toggleTagId,
  type TagRow,
} from "@/lib/tags/tags";

/**
 * Picks a request's tags. Opens a sheet with search, where a name that isn't
 * a tag yet can be added on the spot, so a new event never means leaving the
 * request. Only owners see it.
 */
export function TagPicker({
  id,
  labelId,
  tags,
  value,
  onChange,
  onAdded,
  onClose,
  describedBy,
  disabled,
}: {
  id: string;
  /** The field label's id. The button reads as the label plus the chosen tags. */
  labelId: string;
  /** Every tag, sorted by name. */
  tags: TagRow[];
  /** The picked tags' ids. */
  value: readonly string[];
  onChange: (ids: readonly string[]) => void;
  onAdded: (tag: TagRow) => void;
  /** When the sheet closes, so the tags can be saved together. */
  onClose?: () => void;
  describedBy?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picked = tags.filter((tag) => value.includes(tag.id));
  const visible = tags.filter((tag) => tagMatches(tag, query));
  const name = tidyTagName(query);
  const full = value.length >= MAX_TAGS;
  // Only a name that isn't a tag already can be added.
  const canAdd = name !== "" && !findTag(tags, name);

  function openPicker() {
    setQuery("");
    setError(null);
    setOpen(true);
  }

  function closePicker() {
    setOpen(false);
    onClose?.();
  }

  async function add() {
    const problem = tagNameError(name);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setAdding(true);
    const { data, error: saveError } = await createClient().from("tags").insert({ name }).select(TAG_COLUMNS).single();
    setAdding(false);
    if (saveError) {
      setError(tagSaveErrorMessage(saveError));
      return;
    }
    onAdded(data);
    onChange(addTagId(value, data.id));
    setQuery("");
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (canAdd && !full && !adding) void add();
  }

  return (
    <>
      <Button
        type="button"
        id={id}
        variant="outline"
        className="h-auto min-h-11 w-full justify-between px-3 py-2 text-base font-normal whitespace-normal desktop:text-sm"
        aria-haspopup="dialog"
        aria-labelledby={`${labelId} ${id}`}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={openPicker}
      >
        {picked.length > 0 ? (
          // Spans, since a button can't hold a list.
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {picked.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="max-w-full">
                <span className="truncate">{tag.name}</span>
              </Badge>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">Add tags</span>
        )}
        <ChevronsUpDownIcon className="text-muted-foreground" aria-hidden />
      </Button>

      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : closePicker())}>
        <ResponsiveSheetContent className="gap-0 overflow-hidden touch:h-[min(85dvh,calc(var(--visible-height,100dvh)-1rem))] touch:pb-[env(safe-area-inset-bottom)] desktop:h-[70dvh] desktop:pb-0">
          <SheetHeader>
            <SheetTitle>Tags</SheetTitle>
            <SheetDescription>
              Up to {MAX_TAGS}, like an event or a ministry. Requesters never see them.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-2 px-4 pb-3">
            <div className="relative">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                aria-label="Search or add a tag"
                placeholder="Search or add a tag"
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="done"
                maxLength={MAX_TAG_NAME}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setError(null);
                }}
                onKeyDown={onSearchKeyDown}
                className="h-11 pl-9"
              />
            </div>
            {/* Kept above the list so it stays visible over the iOS keyboard. */}
            {canAdd && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-start"
                onClick={() => void add()}
                disabled={full || adding}
              >
                <PlusIcon />
                <span className="truncate">
                  {adding ? "Adding…" : <>Add &ldquo;{name}&rdquo; as a new tag</>}
                </span>
              </Button>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {full && (
              <p role="status" className="text-sm text-muted-foreground">
                A request can have up to {MAX_TAGS} tags. Take one off to pick another.
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {visible.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {tags.length > 0 ? <>No tags match &ldquo;{name}&rdquo;.</> : "No tags yet. Type a name to add one."}
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {visible.map((tag) => {
                  const isPicked = value.includes(tag.id);
                  return (
                    <li key={tag.id}>
                      <button
                        type="button"
                        aria-pressed={isPicked}
                        disabled={!isPicked && full}
                        className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-50"
                        onClick={() => onChange(toggleTagId(value, tag.id))}
                      >
                        <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                        {isPicked && <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <SheetFooter className="mt-0 border-t">
            <Button type="button" className="h-11 w-full" onClick={closePicker}>
              Done
            </Button>
          </SheetFooter>
        </ResponsiveSheetContent>
      </Sheet>
    </>
  );
}
