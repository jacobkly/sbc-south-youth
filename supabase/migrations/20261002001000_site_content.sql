-- Heads-ups and events for the public site, in their own site schema.
--
-- Site editors manage both through RLS. Nobody else reads them, not even with
-- the secret key: the public site gets what's live only through
-- site.public_posts() and site.public_events(), which only service_role can
-- call. anon can't reach the schema at all.
--
-- Anything that's been posted stays: only drafts can be deleted. A heads-up
-- is ended instead, and an event is cancelled, which keeps its page up and
-- tells subscribed calendars. Every edit to an event bumps its sequence, so
-- those calendars pick up the change.

create schema site;

comment on schema site is 'Public site content and messages. Clients reach it only through RLS or service_role functions.';

grant usage on schema site to authenticated, service_role;

create type site.post_status as enum ('draft', 'published');
create type site.post_tone as enum ('info', 'cancellation');
create type site.event_status as enum ('draft', 'published', 'cancelled');

-- A heads-up shows while it's published and now is between starts_at and
-- ends_at. A future start schedules it, and ending it sets ends_at to now.
create table site.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  body text not null check (char_length(body) <= 280),
  -- https, or a page on the site like /events/retreat. Never //host.
  link_url text check (char_length(link_url) <= 500 and link_url ~ '^(https://|/(?!/))'),
  link_label text check (char_length(btrim(link_label)) between 1 and 24),
  tone site.post_tone not null default 'info',
  pinned boolean not null default false,
  status site.post_status not null default 'draft',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default now() + interval '7 days',
  created_by uuid default auth.uid() references public.users (id) on delete set null,
  updated_by uuid default auth.uid() references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (link_label is null or link_url is not null)
);

comment on table site.posts is 'Heads-ups on Home and This Week. Public only through site.public_posts().';

create index posts_live_idx on site.posts (ends_at, starts_at) where status = 'published';

-- An all-day event starts at midnight in America/Los_Angeles on its first day
-- and ends at midnight after its last. Cancelled events stay public with a
-- banner and STATUS:CANCELLED in the calendar feed.
create table site.events (
  id uuid primary key default gen_random_uuid(),
  -- Shares /events/<slug> with the weekly gatherings, which own weekly-.
  slug text not null unique check (
    char_length(slug) <= 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and slug !~ '^weekly-'
  ),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  summary text check (char_length(summary) <= 160),
  body text check (char_length(body) <= 4000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location_name text check (char_length(location_name) <= 100),
  address text check (char_length(address) <= 200),
  cost_note text check (char_length(cost_note) <= 60),
  featured boolean not null default false,
  status site.event_status not null default 'draft',
  cancel_reason text check (char_length(btrim(cancel_reason)) between 1 and 200),
  -- The calendar feed's SEQUENCE. Only the bump_sequence trigger moves it.
  sequence integer not null default 0,
  created_by uuid default auth.uid() references public.users (id) on delete set null,
  updated_by uuid default auth.uid() references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  check (cancel_reason is null or status = 'cancelled')
);

comment on table site.events is 'Events on the site and in the calendar feed. Public only through site.public_events().';

create index events_starts_at_idx on site.events (starts_at) where status <> 'draft';

-- Signed-in people write only the content columns. Who wrote it, when, and
-- the sequence are set by defaults and triggers. The secret key gets nothing.
alter table site.posts enable row level security;
alter table site.events enable row level security;

revoke all on table site.posts, site.events from public, anon, authenticated, service_role;

grant select, delete on table site.posts, site.events to authenticated;
grant insert (id, title, body, link_url, link_label, tone, pinned, status, starts_at, ends_at)
  on table site.posts to authenticated;
grant update (title, body, link_url, link_label, tone, pinned, status, starts_at, ends_at)
  on table site.posts to authenticated;
grant insert (
  id, slug, title, summary, body, starts_at, ends_at, all_day, location_name, address, cost_note, featured, status,
  cancel_reason
) on table site.events to authenticated;
grant update (
  slug, title, summary, body, starts_at, ends_at, all_day, location_name, address, cost_note, featured, status,
  cancel_reason
) on table site.events to authenticated;

create policy "Site editors manage posts"
  on site.posts for all
  to authenticated
  using ((select public.has_role('site_editor')))
  with check ((select public.has_role('site_editor')));

create policy "Site editors manage events"
  on site.events for all
  to authenticated
  using ((select public.has_role('site_editor')))
  with check ((select public.has_role('site_editor')));

-- Names the signed-in person as the last editor. With no one signed in, as in
-- the seed, the write keeps whatever it set.
create function site.set_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

-- Bumps an event's sequence when anything a calendar could show changes.
-- Saving with no change, or a change only to who and when, keeps it.
create function site.bump_sequence()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_bookkeeping constant text[] := array['sequence', 'created_by', 'updated_by', 'created_at', 'updated_at'];
begin
  if (to_jsonb(new) - v_bookkeeping) is distinct from (to_jsonb(old) - v_bookkeeping) then
    new.sequence := old.sequence + 1;
  end if;
  return new;
end;
$$;

-- Once an event is out, calendars have it, so it can be cancelled but never
-- quietly turned back into a draft and deleted.
create function site.keep_published()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' and new.status = 'draft' then
    raise exception 'An event that''s been published can''t go back to a draft.' using errcode = '55000';
  end if;
  return new;
end;
$$;

-- Only drafts can be deleted. Posts and events both have a draft status.
create function site.only_delete_drafts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status::text <> 'draft' then
    if tg_table_name = 'events' then
      raise exception 'Only a draft event can be deleted. Cancel it instead.' using errcode = '55000';
    end if;
    raise exception 'Only a draft heads-up can be deleted. End it instead.' using errcode = '55000';
  end if;
  return old;
end;
$$;

revoke execute on function site.set_updated_by(), site.bump_sequence(), site.keep_published(), site.only_delete_drafts()
  from public, anon, authenticated;

create trigger set_updated_at
  before update on site.posts
  for each row execute function public.set_updated_at();

create trigger set_updated_by
  before update on site.posts
  for each row execute function site.set_updated_by();

create trigger only_delete_drafts
  before delete on site.posts
  for each row execute function site.only_delete_drafts();

create trigger set_updated_at
  before update on site.events
  for each row execute function public.set_updated_at();

create trigger set_updated_by
  before update on site.events
  for each row execute function site.set_updated_by();

create trigger bump_sequence
  before update on site.events
  for each row execute function site.bump_sequence();

create trigger keep_published
  before update of status on site.events
  for each row execute function site.keep_published();

create trigger only_delete_drafts
  before delete on site.events
  for each row execute function site.only_delete_drafts();

-- Activity, under the site scope. An event's body can run to 4,000
-- characters, so it stays out of the log, but logging the sequence means an
-- edit to the body alone is still there.
create trigger log_activity
  after insert or update or delete on site.posts
  for each row execute function public.log_activity(
    'site', 'post', 'title',
    'title', 'body', 'link_url', 'link_label', 'tone', 'pinned', 'status', 'starts_at', 'ends_at'
  );

create trigger log_activity
  after insert or update or delete on site.events
  for each row execute function public.log_activity(
    'site', 'event', 'title',
    'slug', 'title', 'summary', 'starts_at', 'ends_at', 'all_day', 'location_name', 'address', 'cost_note', 'featured',
    'status', 'cancel_reason', 'sequence'
  );

-- Live heads-ups for the public site, pinned first, then newest. Only the
-- site's server calls this, with the secret key.
create function site.public_posts()
returns table (
  id uuid,
  title text,
  body text,
  link_url text,
  link_label text,
  tone site.post_tone,
  pinned boolean,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.title, p.body, p.link_url, p.link_label, p.tone, p.pinned, p.starts_at, p.ends_at
  from site.posts p
  where p.status = 'published' and p.starts_at <= now() and p.ends_at > now()
  order by p.pinned desc, p.starts_at desc, p.id;
$$;

-- Published and cancelled events, soonest first, for the event pages and the
-- calendar feed. Past ones are included, so their pages and feed entries stay.
create function site.public_events()
returns table (
  id uuid,
  slug text,
  title text,
  summary text,
  body text,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  location_name text,
  address text,
  cost_note text,
  featured boolean,
  status site.event_status,
  cancel_reason text,
  sequence integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id, e.slug, e.title, e.summary, e.body, e.starts_at, e.ends_at, e.all_day, e.location_name, e.address,
    e.cost_note, e.featured, e.status, e.cancel_reason, e.sequence, e.updated_at
  from site.events e
  where e.status in ('published', 'cancelled')
  order by e.starts_at, e.id;
$$;

revoke execute on function site.public_posts(), site.public_events() from public, anon, authenticated;
grant execute on function site.public_posts(), site.public_events() to service_role;
