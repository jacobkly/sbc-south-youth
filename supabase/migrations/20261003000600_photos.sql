-- Photos for the public site: a public site-photos bucket for the files and
-- site.photos for what each one is and where it shows.
--
-- The browser shrinks each photo to two WebP sizes and uploads them to
-- site-photos/<photo id>/lg.webp and sm.webp, then adds the row. The id is
-- random, so no file is ever named after a person. The bucket is public, so
-- pages load the files by URL, but only site editors list, add, or delete
-- them, and new uploads stop at 95% of the free plan's 1 GB, so receipts
-- always have room.
--
-- A photo shows in one named spot on the site (the site's code names them)
-- or as one event's cover. Putting a photo in a spot or on an event moves the
-- one that was there back to the library. A photo comes down only through
-- site.remove_photo(), which keeps a tombstone of who took it down and why,
-- linked to the takedown request if there was one. The portal then deletes
-- its files. Tombstones go after 2 years.

create type site.photo_status as enum ('published', 'removed');

create table site.photos (
  -- Also the folder its files are in.
  id uuid primary key default gen_random_uuid(),
  -- Describes the scene, never who's in it.
  alt text not null check (char_length(btrim(alt)) between 1 and 200),
  -- Where it shows, like home-hero. Null for one in the library or on an event.
  spot text check (char_length(spot) <= 40 and spot ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  event_id uuid references site.events (id) on delete set null,
  -- The large file's size in pixels, for the page's layout before it loads.
  width integer not null check (width between 1 and 4000),
  height integer not null check (height between 1 and 4000),
  -- Both files together. Set from the files themselves when the row is added.
  bytes_total integer not null default 0 check (bytes_total >= 0),
  status site.photo_status not null default 'published',
  uploaded_by uuid default auth.uid() references public.users (id) on delete set null,
  removed_by uuid references public.users (id) on delete set null,
  removed_reason text check (char_length(removed_reason) between 1 and 200),
  removed_at timestamptz,
  takedown_message_id uuid references site.messages (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (spot is null or event_id is null),
  check ((status = 'removed') = (removed_at is not null)),
  check (status = 'removed' or (removed_by is null and removed_reason is null and takedown_message_id is null)),
  check (status = 'published' or (spot is null and event_id is null and removed_reason is not null))
);

comment on table site.photos is
  'Site photos and their tombstones. Public only through site.public_photos(); taken down only by site.remove_photo().';

create unique index photos_spot_key on site.photos (spot) where spot is not null;
create unique index photos_event_id_key on site.photos (event_id) where event_id is not null;
create index photos_takedown_message_id_idx on site.photos (takedown_message_id) where takedown_message_id is not null;

-- Site editors add photos and change their alt text and placement. Only
-- site.remove_photo() takes one down, and a tombstone can't change. The
-- Messages role sees what came down for a takedown request, to close it.
-- Nobody deletes a row but the nightly job.
alter table site.photos enable row level security;

revoke all on table site.photos from public, anon, authenticated, service_role;

grant select on table site.photos to authenticated;
grant insert (id, alt, spot, event_id, width, height) on table site.photos to authenticated;
grant update (alt, spot, event_id) on table site.photos to authenticated;

create policy "Site editors see photos, and Messages sees takedowns"
  on site.photos for select
  to authenticated
  using (
    (select public.has_role('site_editor'))
    or (takedown_message_id is not null and (select public.has_role('site_messages')))
  );

create policy "Site editors add photos"
  on site.photos for insert
  to authenticated
  with check ((select public.has_role('site_editor')) and status = 'published');

create policy "Site editors change photos that are up"
  on site.photos for update
  to authenticated
  using ((select public.has_role('site_editor')) and status = 'published')
  with check ((select public.has_role('site_editor')) and status = 'published');

-- A new photo's row waits for both of its files, and its size comes from
-- them, so the storage numbers never trust the browser.
create function site.count_photo_files()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_files integer;
  v_bytes bigint;
begin
  select count(*), coalesce(sum((o.metadata ->> 'size')::bigint), 0)
  into v_files, v_bytes
  from storage.objects o
  where o.bucket_id = 'site-photos'
    and o.name in (new.id::text || '/lg.webp', new.id::text || '/sm.webp');

  if v_files <> 2 then
    raise exception 'Upload both sizes of the photo first.' using errcode = '23503';
  end if;

  new.bytes_total := v_bytes;
  return new;
end;
$$;

-- One photo per spot and per event. Taking one moves the photo that was
-- there back to the library, in the same write.
create function site.take_photo_place()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.spot is not null and new.spot is distinct from old.spot then
    update site.photos set spot = null where spot = new.spot and id <> new.id;
  end if;
  if new.event_id is not null and new.event_id is distinct from old.event_id then
    update site.photos set event_id = null where event_id = new.event_id and id <> new.id;
  end if;
  return new;
end;
$$;

revoke execute on function site.count_photo_files(), site.take_photo_place() from public, anon, authenticated;

create trigger count_photo_files
  before insert on site.photos
  for each row execute function site.count_photo_files();

create trigger take_photo_place
  before insert or update of spot, event_id on site.photos
  for each row execute function site.take_photo_place();

create trigger set_updated_at
  before update on site.photos
  for each row execute function public.set_updated_at();

-- Activity, under the site scope, named by the alt text. Only the nightly
-- job deletes, so deletes aren't logged.
create trigger log_activity
  after insert or update on site.photos
  for each row execute function public.log_activity(
    'site', 'photo', 'alt',
    'alt', 'spot', 'event_id', 'status', 'removed_reason'
  );

-- Takes a photo down, keeping its row as a tombstone: who, when, why, and
-- the takedown request if there was one. It leaves its spot or event, so
-- pages stop showing it on their next load. The portal deletes the files
-- after, which the storage policies allow once the photo is down.
create function site.remove_photo(p_id uuid, p_reason text, p_message_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(p_reason, E' \t\r\n');
  v_status site.photo_status;
begin
  if not (select public.has_role('site_editor')) then
    raise exception 'Only a site editor can take a photo down.' using errcode = '42501';
  end if;

  if coalesce(v_reason, '') = '' then
    raise exception 'Say why it''s coming down.' using errcode = '22023';
  end if;

  if char_length(v_reason) > 200 then
    raise exception 'Keep the reason under 200 characters.' using errcode = '22023';
  end if;

  if p_message_id is not null and not exists (
    select 1 from site.messages m where m.id = p_message_id and m.kind = 'takedown'
  ) then
    raise exception 'Link a photo takedown request, or leave it out.' using errcode = '22023';
  end if;

  select p.status into v_status from site.photos p where p.id = p_id for update;

  if not found then
    raise exception 'That photo doesn''t exist.' using errcode = 'P0002';
  end if;

  if v_status = 'removed' then
    raise exception 'That photo is already down.' using errcode = '55000';
  end if;

  update site.photos
  set
    status = 'removed',
    spot = null,
    event_id = null,
    removed_by = auth.uid(),
    removed_reason = v_reason,
    removed_at = now(),
    takedown_message_id = p_message_id
  where id = p_id;
end;
$$;

revoke execute on function site.remove_photo(uuid, text, uuid) from public, anon, service_role;
grant execute on function site.remove_photo(uuid, text, uuid) to authenticated;

-- Whether a photo can go up: all files together are under 95% of the free
-- plan's 1 GB, counted in decimal like the portal's storage bar. The upload
-- policy calls it as the uploader, who can't see every file, so it runs as
-- the owner and answers only yes or no.
create function site.photo_uploads_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0) < 950000000
  from storage.objects o;
$$;

revoke execute on function site.photo_uploads_open() from public, anon, service_role;
grant execute on function site.photo_uploads_open() to authenticated;

-- Placed photos for the public pages: the ones in a spot, and covers of
-- events that have a page. Only the site's server calls this, with the
-- secret key. Files are at site-photos/<id>/lg.webp and sm.webp.
create function site.public_photos()
returns table (
  id uuid,
  spot text,
  event_id uuid,
  alt text,
  width integer,
  height integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.spot, p.event_id, p.alt, p.width, p.height
  from site.photos p
  left join site.events e on e.id = p.event_id
  where p.status = 'published'
    and (p.spot is not null or e.status in ('published', 'cancelled'))
  order by p.spot, p.event_id, p.id;
$$;

revoke execute on function site.public_photos() from public, anon, authenticated;
grant execute on function site.public_photos() to service_role;

-- The bucket. The cap catches a photo the browser didn't shrink; each size
-- aims well under it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-photos',
  'site-photos',
  true,
  1048576, -- 1 MB
  array['image/webp']
);

-- Site editors list the files, which deleting them needs.
create policy "Site editors see photo files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'site-photos' and (select public.has_role('site_editor')));

-- Only the two sizes, in the folder of a photo that hasn't been added yet,
-- so a photo's files never change once it's up and a tombstone's never
-- come back.
create policy "Site editors upload new photo files while storage has room"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'site-photos'
    and (select public.has_role('site_editor'))
    and objects.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(lg|sm)\.webp$'
    and not exists (
      select 1 from site.photos p where p.id::text = (storage.foldername(objects.name))[1]
    )
    and (select site.photo_uploads_open())
  );

-- Files of a photo that's down, or of an upload whose row never got added.
create policy "Site editors delete files of photos that aren't up"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'site-photos'
    and (select public.has_role('site_editor'))
    and not exists (
      select 1 from site.photos p
      where p.id::text = (storage.foldername(objects.name))[1] and p.status = 'published'
    )
  );

-- Tombstones go 2 years after the photo came down. Returns how many went.
create function site.prune_removed_photos()
returns integer
language sql
set search_path = ''
as $$
  with pruned as (
    delete from site.photos
    where status = 'removed' and removed_at < now() - interval '2 years'
    returning 1
  )
  select count(*)::integer from pruned;
$$;

revoke execute on function site.prune_removed_photos() from public, anon, authenticated, service_role;

-- After the other nightly jobs.
select cron.schedule('prune-removed-photos', '25 10 * * *', 'select site.prune_removed_photos()');
