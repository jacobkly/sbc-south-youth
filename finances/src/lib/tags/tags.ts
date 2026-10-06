import { appErrorMessage, RETRY_MESSAGE } from "@/lib/requests/actions";

/** The tag columns the app reads. Keep in sync with TagRow. */
export const TAG_COLUMNS = "id, name";

/** A label on requests, like an event or a ministry. */
export type TagRow = { id: string; name: string };

/** A request's tags, embedded with the request. */
export const REQUEST_TAGS_EMBED = "tags:request_tags(tag:tags(id, name))";

/** As the embed comes back. A tag that can't be read comes back null. */
export type RequestTagLinks = { tag: TagRow | null }[] | null;

// Limits match the checks in the database.
export const MAX_TAGS = 10;
export const MAX_TAG_NAME = 50;

/** The name as the database saves it: trimmed, with each run of spaces as one. */
export function tidyTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** What's wrong with a typed name, checked the way the database checks it, or null. */
export function tagNameError(name: string): string | null {
  const tidy = tidyTagName(name);
  if (!tidy) return "Enter a name.";
  if (tidy.length > MAX_TAG_NAME) return `Keep the name to ${MAX_TAG_NAME} characters or fewer.`;
  return null;
}

function key(name: string): string {
  return tidyTagName(name).toLowerCase();
}

/** By name, without regard to case. */
export function sortTags<T extends TagRow>(tags: readonly T[]): T[] {
  return [...tags].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/** A request's tags, sorted by name. */
export function tagsOf(links: RequestTagLinks): TagRow[] {
  return sortTags((links ?? []).flatMap(({ tag }) => (tag ? [tag] : [])));
}

/** True when the tag's name contains what was typed. */
export function tagMatches(tag: TagRow, query: string): boolean {
  const needle = key(query);
  return !needle || tag.name.toLowerCase().includes(needle);
}

/** The tag with this name, without regard to case or spacing, since names are unique that way. */
export function findTag<T extends TagRow>(tags: readonly T[], name: string): T | undefined {
  const wanted = key(name);
  return tags.find((tag) => tag.name.toLowerCase() === wanted);
}

/** Picks a tag, or takes it off if it's picked. Past the most a request can have, nothing changes. */
export function toggleTagId(ids: readonly string[], id: string): readonly string[] {
  if (ids.includes(id)) return ids.filter((picked) => picked !== id);
  return addTagId(ids, id);
}

/** Picks a tag if it isn't already, while there's room. */
export function addTagId(ids: readonly string[], id: string): readonly string[] {
  if (ids.includes(id) || ids.length >= MAX_TAGS) return ids;
  return [...ids, id];
}

/** True when both have the same tags, in any order. */
export function sameTagIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

type SaveError = { code?: string; message?: string } | null;

function errorMessage(error: SaveError, failed: string): string {
  const message = appErrorMessage(error);
  if (message) return message;
  if (error?.code === "42501") return "Only an owner can change tags.";
  return `${failed} ${RETRY_MESSAGE}`;
}

/** A plain message for a tag that didn't save. Raw database errors never reach the screen. */
export function tagSaveErrorMessage(error: SaveError): string {
  return errorMessage(error, "Couldn't save the tag.");
}

/** A plain message for a request's tags that didn't save. */
export function requestTagsErrorMessage(error: SaveError): string {
  return errorMessage(error, "Couldn't save the tags.");
}
