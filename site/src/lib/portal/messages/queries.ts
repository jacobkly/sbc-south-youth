import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  MESSAGE_PAGE_SIZE,
  MESSAGE_TABS,
  statusesFor,
  type MessageEnv,
  type MessageFilters,
  type MessageKind,
  type MessageRow,
  type MessageTab,
} from "./list";

/**
 * What the Messages screens read, as the signed-in person. RLS lets only
 * the Messages role read any message, so anyone else gets nothing.
 */

/** What the sender gave, and what leaders have done since. */
const SENT = "id, kind, name, email, phone, message, details, env, notified_at, created_at";
const TRIAGE = "status, outcome, assigned_to, internal_note, handled_by, handled_at";
const COLUMNS = `${SENT}, ${TRIAGE}` as const;

/** More takedowns than this waiting at once would be a different problem. */
const TAKEDOWN_LIMIT = 50;

export type MessageList = {
  /** Open photo takedowns, which go first when every kind is showing. */
  takedowns: MessageRow[];
  messages: MessageRow[];
  /** Whether "Show more" has anything left to show. */
  hasMore: boolean;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

function messagesIn(supabase: Supabase, filters: Pick<MessageFilters, "tab" | "env">) {
  return supabase
    .schema("site")
    .from("messages")
    .select(COLUMNS)
    .in("status", statusesFor(filters.tab))
    .eq("env", filters.env);
}

/**
 * One tab's messages. Open ones go oldest first, so whoever's waited
 * longest is at the top, with takedowns ahead of everything else. Closed
 * ones go by when they were closed, newest first.
 */
export async function loadMessages(filters: MessageFilters): Promise<MessageList> {
  const open = filters.tab !== "handled";
  const prioritize = open && filters.kind === "all";
  const shown = filters.pages * MESSAGE_PAGE_SIZE;

  const supabase = await createClient();
  let list = messagesIn(supabase, filters);
  if (filters.kind !== "all") list = list.eq("kind", filters.kind);
  else if (prioritize) list = list.neq("kind", "takedown");
  list = open
    ? list.order("created_at", { ascending: true })
    : list.order("handled_at", { ascending: false }).order("created_at", { ascending: false });

  const [page, takedowns] = await Promise.all([
    // One past the page, to know whether there are more.
    list.order("id").range(0, shown),
    prioritize
      ? messagesIn(supabase, filters)
          .eq("kind", "takedown")
          .order("created_at", { ascending: true })
          .limit(TAKEDOWN_LIMIT)
      : null,
  ]);
  if (page.error) throw page.error;
  if (takedowns?.error) throw takedowns.error;
  return {
    takedowns: takedowns?.data ?? [],
    messages: page.data.slice(0, shown),
    hasMore: page.data.length > shown,
  };
}

/** How many messages each tab has, of one kind or every kind. */
export async function loadMessageCounts(
  env: MessageEnv,
  kind: MessageKind | "all",
): Promise<Record<MessageTab, number>> {
  const supabase = await createClient();
  const counts = await Promise.all(
    MESSAGE_TABS.map(async (tab) => {
      let query = supabase
        .schema("site")
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("status", statusesFor(tab))
        .eq("env", env);
      if (kind !== "all") query = query.eq("kind", kind);
      const { count, error } = await query;
      if (error) throw error;
      return [tab, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<MessageTab, number>;
}

/** How many production messages are new, for Home. */
export async function loadNewMessageCount(): Promise<number> {
  return (await loadMessageCounts("production", "all")).new;
}

/** One message, or null when it isn't there or isn't theirs to see. */
export async function loadMessage(id: unknown): Promise<MessageRow | null> {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("site")
    .from("messages")
    .select(COLUMNS)
    .eq("id", id.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type Assignee = { id: string; name: string; avatarPath: string | null };

/** Active leaders with Messages, whom a message can be assigned to. */
export async function loadAssignees(): Promise<Assignee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema("site").rpc("message_assignees");
  if (error) throw error;
  return data.map((person) => ({
    id: person.id,
    name: person.full_name.trim() || "Unnamed leader",
    avatarPath: person.avatar_path,
  }));
}
