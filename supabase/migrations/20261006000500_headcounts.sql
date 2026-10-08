-- How many came to youth each week: one number per night that counts
-- everyone there, leaders included, since leaders are youth too.
--
-- The Attendance role adds and fixes them, finance viewers read them, and
-- owners do both. Nights are usually Fridays, but one can move, so any past
-- date works, once. Every change is in Activity, where only the Attendance
-- role and owners see it.

create table public.headcounts (
  id uuid primary key default gen_random_uuid(),
  night date not null unique,
  total integer not null check (total between 1 and 1000),
  created_by uuid default auth.uid() references public.users (id) on delete set null,
  updated_by uuid default auth.uid() references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.headcounts is 'How many people came to each night of youth, leaders included.';

-- Signed-in people write only the night and the total. Who wrote it and when
-- are set by defaults and triggers. The secret key gets nothing.
alter table public.headcounts enable row level security;

revoke all on table public.headcounts from public, anon, authenticated, service_role;

grant select, delete on table public.headcounts to authenticated;
grant insert (id, night, total) on table public.headcounts to authenticated;
grant update (night, total) on table public.headcounts to authenticated;

create policy "Attendance and finance viewers read headcounts"
  on public.headcounts for select
  to authenticated
  using ((select public.has_role('attendance', 'finance_viewer')));

create policy "Attendance adds headcounts"
  on public.headcounts for insert
  to authenticated
  with check ((select public.has_role('attendance')));

create policy "Attendance changes headcounts"
  on public.headcounts for update
  to authenticated
  using ((select public.has_role('attendance')))
  with check ((select public.has_role('attendance')));

create policy "Attendance removes headcounts"
  on public.headcounts for delete
  to authenticated
  using ((select public.has_role('attendance')));

-- Turns away a night that hasn't happened yet, or one that already has a
-- count, in words the portal can show. The unique constraint still backs up
-- the second check if two saves race. Names the signed-in person as the last
-- editor.
create function public.guard_headcount()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.night > (now() at time zone 'America/Los_Angeles')::date then
    raise exception 'The night can''t be in the future.' using errcode = '22023';
  end if;

  if exists (select 1 from public.headcounts h where h.night = new.night and h.id <> new.id) then
    raise exception '% already has a headcount. Change that one instead.', to_char(new.night, 'Mon FMDD, YYYY')
      using errcode = '23505';
  end if;

  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

revoke execute on function public.guard_headcount() from public, anon, authenticated;

create trigger guard_headcount
  before insert or update of night, total on public.headcounts
  for each row execute function public.guard_headcount();

create trigger set_updated_at
  before update on public.headcounts
  for each row execute function public.set_updated_at();

create trigger log_activity
  after insert or update or delete on public.headcounts
  for each row execute function public.log_activity('site', 'headcount', 'night', 'night', 'total');

-- Headcount rows are only for the Attendance role (and owners), the same
-- people who change them. Finance viewers read the counts but not who changed
-- them.
alter policy "Activity is readable by scope"
  on public.activity_log
  using (
    case scope
      when 'site' then
        case entity_type
          when 'message' then (select public.has_role('site_messages'))
          when 'headcount' then (select public.has_role('attendance'))
          else (select public.has_role('site_editor', 'site_messages'))
        end
      when 'finances' then (select public.has_role('finance_viewer'))
      when 'platform' then (select public.has_role('owner'))
      else false
    end
  );
