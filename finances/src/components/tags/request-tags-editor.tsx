"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TagPicker } from "@/components/tags/tag-picker";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { requestTagsErrorMessage, sameTagIds, sortTags, type TagRow } from "@/lib/tags/tags";

/**
 * An owner's way to change a request's tags in any status, since a tag only
 * labels it. The picks save together when the sheet closes, so the history
 * gets one entry, not one per tap.
 */
export function RequestTagsEditor({
  requestId,
  labelId,
  tags: initialTags,
  tagIds,
}: {
  requestId: string;
  /** The label's id, so the button reads as "Tags" plus the picked ones. */
  labelId: string;
  /** Every tag, sorted by name. */
  tags: TagRow[];
  /** The request's tags as saved. */
  tagIds: string[];
}) {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [value, setValue] = useState<readonly string[]>(tagIds);
  const [saved, setSaved] = useState<readonly string[]>(tagIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (sameTagIds(value, saved)) {
      setError(null);
      return;
    }
    setError(null);
    setSaving(true);
    const { error: saveError } = await createClient().rpc("set_request_tags", {
      p_request_id: requestId,
      p_tag_ids: [...value],
    });
    setSaving(false);
    if (saveError) {
      setError(requestTagsErrorMessage(saveError));
      return;
    }
    setSaved(value);
    // Shows the change in the history.
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <TagPicker
        id="request-tags"
        labelId={labelId}
        tags={tags}
        value={value}
        onChange={setValue}
        onAdded={(added) => setTags((current) => sortTags([...current, added]))}
        onClose={() => void save()}
        disabled={saving}
      />
      {saving && (
        <p role="status" className="text-sm text-muted-foreground">
          Saving…
        </p>
      )}
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Button type="button" variant="outline" className="h-11" onClick={() => void save()}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
