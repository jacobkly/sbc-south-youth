-- Money coming in, next to the requests that track money going out.
--
-- Youth income is one row per tithe, or one total for an event like a bake
-- sale, which can include the tithes given there. A tithe is only its date,
-- amount, and how it came in. There's no name or note on it, so who gave has
-- nowhere to go. An event can have a name, and its money can come in more
-- than one way, so its method can be left empty.
--
-- The cafe is one gross amount per Monday to Sunday week, dated on the Sunday
-- it ends. Profit comes from the cafe's requests, so a week has no costs.
--
-- Owners with two-step sign-in add, change, and delete it. Owners and finance
-- viewers read it, and every change goes to the activity log as finance
-- activity, which is never pruned.

create type public.income_method as enum ('cash_app', 'zelle', 'cash');

create type public.youth_income_kind as enum ('tithe', 'event');

create table public.youth_income (
  id uuid primary key default gen_random_uuid(),
  kind public.youth_income_kind not null default 'tithe',
  received_on date not null check (received_on >= date '2000-01-01'),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000), -- up to $1,000,000
  -- Empty only for an event whose money came in more than one way.
  method public.income_method,
  event_name text check (event_name is null or char_length(event_name) between 1 and 100),
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint youth_income_tithe_details check (kind = 'event' or (event_name is null and method is not null))
);

comment on table public.youth_income is
  'Youth money in: each tithe on its own, or one total for an event. Never a name of who gave.';

create index youth_income_received_on_idx on public.youth_income (received_on desc);

create table public.cafe_weeks (
  id uuid primary key default gen_random_uuid(),
  -- The Sunday that ends the Monday to Sunday week. January 2, 2000 is the first Sunday of 2000.
  week_ending date not null unique check (week_ending >= date '2000-01-02' and extract(isodow from week_ending) = 7),
  sales_cents integer not null check (sales_cents >= 0 and sales_cents <= 100000000),
  note text check (note is null or char_length(note) between 1 and 500),
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cafe_weeks is
  'The cafe''s gross sales for each Monday to Sunday week, dated on the Sunday it ends.';

create trigger set_updated_at
  before update on public.youth_income
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.cafe_weeks
  for each row execute function public.set_updated_at();

-- Tidies the name and says what's wrong in words the app can show. The checks
-- on the table back these up.
create function public.guard_youth_income()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.event_name := nullif(trim(new.event_name), '');

  if (tg_op = 'INSERT' or new.received_on is distinct from old.received_on)
     and new.received_on > (now() at time zone 'America/Los_Angeles')::date then
    raise exception 'The date can''t be in the future.' using errcode = '22023';
  end if;

  if new.kind = 'tithe' and new.event_name is not null then
    raise exception 'Only an event can have a name.' using errcode = '22023';
  end if;

  if new.kind = 'tithe' and new.method is null then
    raise exception 'Choose how the tithe came in.' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_youth_income() from public, anon, authenticated;

create trigger guard_youth_income
  before insert or update on public.youth_income
  for each row execute function public.guard_youth_income();

-- This week can be entered before it ends, but never a week that hasn't
-- started. Each week has one row, so opening a week again changes it.
create function public.guard_cafe_week()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
begin
  new.note := nullif(trim(new.note), '');

  if extract(isodow from new.week_ending) <> 7 then
    raise exception 'A cafe week ends on a Sunday.' using errcode = '22023';
  end if;

  if (tg_op = 'INSERT' or new.week_ending is distinct from old.week_ending)
     and new.week_ending > v_today + (7 - extract(isodow from v_today))::integer then
    raise exception 'That week hasn''t started yet.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.cafe_weeks w
    where w.week_ending = new.week_ending and w.id <> new.id
  ) then
    raise exception 'That week already has its sales. Open it to change them.' using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_cafe_week() from public, anon, authenticated;

create trigger guard_cafe_week
  before insert or update on public.cafe_weeks
  for each row execute function public.guard_cafe_week();

-- History. A tithe's row keeps what it has: the kind, date, amount, and method.
create trigger log_activity
  after insert or update or delete on public.youth_income
  for each row execute function public.log_activity(
    'finances', 'youth_income', 'event_name', 'kind', 'received_on', 'amount_cents', 'method', 'event_name'
  );

create trigger log_activity
  after insert or update or delete on public.cafe_weeks
  for each row execute function public.log_activity('finances', 'cafe_week', '', 'week_ending', 'sales_cents', 'note');

-- Access. The app picks each row's id, so a retry after a dropped connection
-- can't save the same entry twice. Who entered it always comes from the
-- session.
alter table public.youth_income enable row level security;
alter table public.cafe_weeks enable row level security;

revoke all on table public.youth_income from public, anon, authenticated, service_role;
grant select, delete on table public.youth_income to authenticated;
grant insert (id, kind, received_on, amount_cents, method, event_name) on table public.youth_income to authenticated;
grant update (kind, received_on, amount_cents, method, event_name) on table public.youth_income to authenticated;

revoke all on table public.cafe_weeks from public, anon, authenticated, service_role;
grant select, delete on table public.cafe_weeks to authenticated;
grant insert (id, week_ending, sales_cents, note) on table public.cafe_weeks to authenticated;
grant update (week_ending, sales_cents, note) on table public.cafe_weeks to authenticated;

create policy "Owners and finance viewers read youth income"
  on public.youth_income for select
  to authenticated
  using ((select public.has_role('finance_viewer')));

create policy "Owners add youth income"
  on public.youth_income for insert
  to authenticated
  with check ((select public.has_role('owner')) and (select auth.jwt() ->> 'aal') = 'aal2');

create policy "Owners change youth income"
  on public.youth_income for update
  to authenticated
  using ((select public.has_role('owner')) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select public.has_role('owner')) and (select auth.jwt() ->> 'aal') = 'aal2');

create policy "Owners delete youth income"
  on public.youth_income for delete
  to authenticated
  using ((select public.has_role('owner')) and (select auth.jwt() ->> 'aal') = 'aal2');

create policy "Owners and finance viewers read cafe weeks"
  on public.cafe_weeks for select
  to authenticated
  using ((select public.has_role('finance_viewer')));

create policy "Owners add cafe weeks"
  on public.cafe_weeks for insert
  to authenticated
  with check ((select public.has_role('owner')) and (select auth.jwt() ->> 'aal') = 'aal2');

create policy "Owners change cafe weeks"
  on public.cafe_weeks for update
  to authenticated
  using ((select public.has_role('owner')) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select public.has_role('owner')) and (select auth.jwt() ->> 'aal') = 'aal2');

create policy "Owners delete cafe weeks"
  on public.cafe_weeks for delete
  to authenticated
  using ((select public.has_role('owner')) and (select auth.jwt() ->> 'aal') = 'aal2');
