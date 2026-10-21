-- Cafe weeks from Square, and the church's paybacks for the cafe's discounts.
--
-- Square's sales summary splits a week's money into lines, and each week now
-- keeps them all. Gross sales stay in sales_cents. Less returns and discounts
-- they're net sales. Plus gift card sales, taxes, and tips they're the
-- payments collected, and less Square's fees they're the net total. Gift card
-- redemptions are counted as payments too, though the card's money already
-- came in when it was sold, so the money the cafe got from Square is the net
-- total less gift card redemptions. A week typed by hand keeps zeros for the
-- other lines, so its money stays its gross.
--
-- The church pays back every discount, once a quarter, by bank transfer. Each
-- transfer is a row in cafe_paybacks for the calendar quarter it covers, and a
-- quarter can have more than one when a payment comes in short. A week counts
-- in the quarter of the Sunday it ends.
--
-- Like the cafe's weeks, owners who don't owe an authenticator code add,
-- change, and delete paybacks. Owners and finance viewers read them, and
-- every change goes to the activity log as finance activity.

alter table public.cafe_weeks
  add column returns_cents integer not null default 0 check (returns_cents >= 0 and returns_cents <= 100000000),
  add column discounts_cents integer not null default 0 check (discounts_cents >= 0 and discounts_cents <= 100000000),
  add column gift_card_sales_cents integer not null default 0
    check (gift_card_sales_cents >= 0 and gift_card_sales_cents <= 100000000),
  add column gift_card_redeemed_cents integer not null default 0
    check (gift_card_redeemed_cents >= 0 and gift_card_redeemed_cents <= 100000000),
  add column taxes_cents integer not null default 0 check (taxes_cents >= 0 and taxes_cents <= 100000000),
  add column tips_cents integer not null default 0 check (tips_cents >= 0 and tips_cents <= 100000000),
  add column fees_cents integer not null default 0 check (fees_cents >= 0 and fees_cents <= 100000000),
  -- Where the numbers came from: typed in, or read from Square's file.
  add column source text not null default 'manual' check (source in ('manual', 'square'));

comment on table public.cafe_weeks is
  'The cafe''s sales for each Monday to Sunday week, dated on the Sunday it ends, line by line as Square adds them up.';

comment on column public.cafe_weeks.sales_cents is 'Gross sales, before returns and discounts.';

grant insert (
  returns_cents, discounts_cents, gift_card_sales_cents, gift_card_redeemed_cents, taxes_cents, tips_cents, fees_cents,
  source
) on table public.cafe_weeks to authenticated;

grant update (
  returns_cents, discounts_cents, gift_card_sales_cents, gift_card_redeemed_cents, taxes_cents, tips_cents, fees_cents,
  source
) on table public.cafe_weeks to authenticated;

-- History keeps every line.
drop trigger log_activity on public.cafe_weeks;

create trigger log_activity
  after insert or update or delete on public.cafe_weeks
  for each row execute function public.log_activity(
    'finances', 'cafe_week', '', 'week_ending', 'sales_cents', 'returns_cents', 'discounts_cents',
    'gift_card_sales_cents', 'gift_card_redeemed_cents', 'taxes_cents', 'tips_cents', 'fees_cents', 'source', 'note'
  );

-- What the church pays back. Only discounts for now.
create type public.cafe_payback_kind as enum ('discounts');

create table public.cafe_paybacks (
  id uuid primary key default gen_random_uuid(),
  kind public.cafe_payback_kind not null default 'discounts',
  -- The first day of the calendar quarter it covers.
  quarter_start date not null check (
    quarter_start >= date '2000-01-01'
    and extract(day from quarter_start) = 1
    and extract(month from quarter_start) in (1, 4, 7, 10)
  ),
  received_on date not null check (received_on >= date '2000-01-01'),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000), -- up to $1,000,000
  note text check (note is null or char_length(note) between 1 and 500),
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cafe_paybacks is
  'Each transfer the church makes to pay back the cafe''s discounts, for the calendar quarter it covers.';

create index cafe_paybacks_quarter_start_idx on public.cafe_paybacks (quarter_start desc);

create trigger set_updated_at
  before update on public.cafe_paybacks
  for each row execute function public.set_updated_at();

-- Tidies the note and says what's wrong in words the app can show. The checks
-- on the table back these up.
create function public.guard_cafe_payback()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
begin
  new.note := nullif(trim(new.note), '');

  if new.quarter_start <> date_trunc('quarter', new.quarter_start)::date then
    raise exception 'A payback is for a quarter, which starts on January 1, April 1, July 1, or October 1.'
      using errcode = '22023';
  end if;

  if (tg_op = 'INSERT' or new.quarter_start is distinct from old.quarter_start)
     and new.quarter_start > v_today then
    raise exception 'That quarter hasn''t started yet.' using errcode = '22023';
  end if;

  if (tg_op = 'INSERT' or new.received_on is distinct from old.received_on)
     and new.received_on > v_today then
    raise exception 'The date can''t be in the future.' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_cafe_payback() from public, anon, authenticated;

create trigger guard_cafe_payback
  before insert or update on public.cafe_paybacks
  for each row execute function public.guard_cafe_payback();

create trigger log_activity
  after insert or update or delete on public.cafe_paybacks
  for each row execute function public.log_activity(
    'finances', 'cafe_payback', '', 'kind', 'quarter_start', 'received_on', 'amount_cents', 'note'
  );

-- Access. The app picks each row's id, so a retry after a dropped connection
-- can't save the same payback twice. Who entered it always comes from the
-- session.
alter table public.cafe_paybacks enable row level security;

revoke all on table public.cafe_paybacks from public, anon, authenticated, service_role;
grant select, delete on table public.cafe_paybacks to authenticated;
grant insert (id, kind, quarter_start, received_on, amount_cents, note) on table public.cafe_paybacks to authenticated;
grant update (kind, quarter_start, received_on, amount_cents, note) on table public.cafe_paybacks to authenticated;

create policy "Owners and finance viewers read cafe paybacks"
  on public.cafe_paybacks for select
  to authenticated
  using ((select public.has_role('finance_viewer')));

create policy "Owners add cafe paybacks"
  on public.cafe_paybacks for insert
  to authenticated
  with check ((select public.has_role('owner')) and not (select public.needs_code()));

create policy "Owners change cafe paybacks"
  on public.cafe_paybacks for update
  to authenticated
  using ((select public.has_role('owner')) and not (select public.needs_code()))
  with check ((select public.has_role('owner')) and not (select public.needs_code()));

create policy "Owners delete cafe paybacks"
  on public.cafe_paybacks for delete
  to authenticated
  using ((select public.has_role('owner')) and not (select public.needs_code()));
