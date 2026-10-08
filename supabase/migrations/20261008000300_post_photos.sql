-- A heads-up can have its own photo, the way an event has a cover. A photo
-- still holds one place: a spot, an event's cover, or a heads-up. Putting
-- one on a heads-up moves the photo it had back to the library, and so does
-- deleting a draft heads-up.

alter table site.photos
  add column post_id uuid references site.posts (id) on delete set null;

-- The original checks had no names, so Postgres named them in order.
alter table site.photos
  drop constraint photos_check,
  add constraint photos_one_place check (num_nonnulls(spot, event_id, post_id) <= 1),
  drop constraint photos_check3,
  add constraint photos_removed_off_site check (
    status = 'published' or (spot is null and event_id is null and post_id is null and removed_reason is not null)
  );

create unique index photos_post_id_key on site.photos (post_id) where post_id is not null;

-- The portal adds a photo to the library first, then puts it on the
-- heads-up when the heads-up saves.
grant update (post_id) on table site.photos to authenticated;

-- One photo per spot, per event, and per heads-up. Taking one moves the
-- photo that was there back to the library, in the same write.
create or replace function site.take_photo_place()
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
  if new.post_id is not null and new.post_id is distinct from old.post_id then
    update site.photos set post_id = null where post_id = new.post_id and id <> new.id;
  end if;
  return new;
end;
$$;

drop trigger take_photo_place on site.photos;

create trigger take_photo_place
  before insert or update of spot, event_id, post_id on site.photos
  for each row execute function site.take_photo_place();

drop trigger log_activity on site.photos;

create trigger log_activity
  after insert or update on site.photos
  for each row execute function public.log_activity(
    'site', 'photo', 'alt',
    'alt', 'spot', 'event_id', 'post_id', 'status', 'removed_reason'
  );

-- Taking a photo down takes it off its heads-up too.
create or replace function site.remove_photo(p_id uuid, p_reason text, p_message_id uuid default null)
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
    post_id = null,
    removed_by = auth.uid(),
    removed_reason = v_reason,
    removed_at = now(),
    takedown_message_id = p_message_id
  where id = p_id;
end;
$$;

-- Placed photos for the public pages: the ones in a spot, covers of events
-- that have a page, and photos of published heads-ups that haven't come
-- down. A scheduled heads-up's photo comes along early, so it's cached by
-- the time the heads-up goes up.
drop function site.public_photos();

create function site.public_photos()
returns table (
  id uuid,
  spot text,
  event_id uuid,
  post_id uuid,
  alt text,
  width integer,
  height integer,
  mime_type text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.spot, p.event_id, p.post_id, p.alt, p.width, p.height, p.mime_type
  from site.photos p
  left join site.events e on e.id = p.event_id
  left join site.posts h on h.id = p.post_id
  where p.status = 'published'
    and (
      p.spot is not null
      or e.status in ('published', 'cancelled')
      or (h.status = 'published' and h.ends_at > now())
    )
  order by p.spot, p.event_id, p.post_id, p.id;
$$;

revoke execute on function site.public_photos() from public, anon, authenticated;
grant execute on function site.public_photos() to service_role;
