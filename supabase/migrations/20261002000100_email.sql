-- Every email the apps send, and the quota guard in front of Resend.
--
-- email_log is both the record and the outbox: email_reserve() checks the
-- quota and writes a row, the drain claims queued rows with email_claim() and
-- marks them with email_mark(), and Resend webhooks report what happened next
-- through email_record_webhook(). Only service_role runs those four. Owners
-- read both tables and start sending to a suppressed address again through
-- email_unsuppress().

-- Declared in the order an email moves through them, so greatest() keeps the
-- furthest status when Resend's events arrive out of order. The first two
-- mean it was never sent.
create type public.email_status as enum (
  'skipped_quota',
  'suppressed',
  'queued',
  'sending',
  'sent',
  'failed',
  'delivered',
  'bounced',
  'complained'
);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  resend_id text unique check (char_length(resend_id) <= 100),
  template text not null check (template ~ '^[a-z][a-z0-9-]{0,49}$'),
  -- 1 sign-in codes, 2 invites, 3 finance notifications, 4 form alerts,
  -- 5 the daily digest.
  priority smallint not null check (priority between 1 and 5),
  -- Cleared after 90 days.
  to_address text check (char_length(to_address) <= 254),
  subject text check (char_length(subject) <= 300),
  scope text not null check (scope in ('site', 'finances', 'platform')),
  related_type text check (char_length(related_type) <= 50),
  related_id uuid,
  env text not null default 'production' check (env in ('production', 'staging')),
  status public.email_status not null,
  error text check (char_length(error) <= 1000),
  attempts smallint not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Whether Resend counts it: everything but skips and sends it refused.
  counts_toward_quota boolean not null generated always as (
    status not in ('skipped_quota', 'suppressed') and (status <> 'failed' or resend_id is not null)
  ) stored
);

comment on table public.email_log is
  'Every email the apps send or skip, and the outbox the drain sends from. Written only by the email_* functions.';

create index email_log_quota_idx on public.email_log (created_at desc) where counts_toward_quota;
create index email_log_outbox_idx on public.email_log (env, priority, created_at) where status in ('queued', 'sending');
create index email_log_created_at_idx on public.email_log (created_at desc, id desc);

create trigger set_updated_at
  before update on public.email_log
  for each row execute function public.set_updated_at();

-- Addresses that bounced or complained. Nothing more is sent to them until an
-- owner says so.
create table public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  address text not null unique check (address = lower(btrim(address)) and char_length(address) between 3 and 254),
  reason text not null check (reason in ('bounced', 'complained')),
  email_log_id uuid references public.email_log (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.email_suppressions is
  'Addresses that bounced or complained. Written by email_record_webhook(), removed by email_unsuppress().';

alter table public.email_log enable row level security;
alter table public.email_suppressions enable row level security;

-- Owners read both. Nobody writes them directly, not even with the secret key.
revoke all on table public.email_log, public.email_suppressions from anon, authenticated, service_role;
grant select on table public.email_log, public.email_suppressions to authenticated;

create policy "Owners read the email log"
  on public.email_log for select
  to authenticated
  using ((select public.has_role('owner')));

create policy "Owners read suppressed addresses"
  on public.email_suppressions for select
  to authenticated
  using ((select public.has_role('owner')));

-- Checks the quota and logs the email, as queued, skipped_quota, or
-- suppressed. Only queued emails may be sent.
--
-- Resend's free plan allows 100 emails a day and 3,000 a month, and we can't
-- tell when its windows reset, so sends are counted over the last 24 hours
-- and the last 31 days. Lower priorities stop early to keep room for sign-in
-- codes: invites at 90 a day, finance notifications and form alerts at 80,
-- and everything but sign-in codes at 2,900 a month. The daily digest gathers
-- what form alerts couldn't send, so it may use the room up to 100, once a
-- day for each person.
create function public.email_reserve(
  p_template text,
  p_priority integer,
  p_to text,
  p_subject text,
  p_scope text,
  p_env text default 'production',
  p_related_type text default null,
  p_related_id uuid default null
)
returns public.email_log
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to text := lower(btrim(p_to));
  v_today integer;
  v_month integer;
  v_status public.email_status;
  v_row public.email_log;
begin
  if p_priority is null or p_priority not between 1 and 5 then
    raise exception 'Choose a priority from 1 to 5.' using errcode = '22023';
  end if;

  if v_to is null or v_to not like '_%@_%' then
    raise exception 'The email needs an address.' using errcode = '22023';
  end if;

  -- One reserve at a time, so two can't both take the last place.
  perform pg_advisory_xact_lock(hashtext('public.email_reserve'));

  select
    count(*) filter (where l.created_at > now() - interval '24 hours'),
    count(*)
  into v_today, v_month
  from public.email_log l
  where l.counts_toward_quota and l.created_at > now() - interval '31 days';

  v_status := case
    when exists (select 1 from public.email_suppressions s where s.address = v_to) then 'suppressed'
    when v_today >= case p_priority when 1 then 100 when 2 then 90 when 5 then 100 else 80 end then 'skipped_quota'
    when v_month >= case p_priority when 1 then 3000 else 2900 end then 'skipped_quota'
    when p_priority = 5 and exists (
      select 1 from public.email_log l
      where l.priority = 5
        and l.to_address = v_to
        and l.counts_toward_quota
        and (l.created_at at time zone 'America/Los_Angeles')::date = (now() at time zone 'America/Los_Angeles')::date
    ) then 'skipped_quota'
    else 'queued'
  end;

  insert into public.email_log (template, priority, to_address, subject, scope, env, related_type, related_id, status)
  values (p_template, p_priority, v_to, p_subject, p_scope, p_env, p_related_type, p_related_id, v_status)
  returning * into v_row;

  return v_row;
end;
$$;

-- Hands the drain up to p_limit queued emails for its environment, highest
-- priority first, and marks them sending. Staging and production share the
-- log, and each drain sends only its own.
--
-- An email left sending for 15 minutes is handed out again, up to three
-- tries, then marked failed. The drain sends with the row's ID as Resend's
-- idempotency key, so a retry never sends twice.
create function public.email_claim(p_env text, p_limit integer default 10)
returns setof public.email_log
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_env is null or p_env not in ('production', 'staging') then
    raise exception 'Claim emails for production or staging.' using errcode = '22023';
  end if;

  update public.email_log
  set status = 'failed', error = 'Sending stopped partway three times.'
  where env = p_env
    and status = 'sending'
    and attempts >= 3
    and updated_at < now() - interval '15 minutes';

  return query
  with claimed as (
    update public.email_log l
    set status = 'sending', attempts = l.attempts + 1
    where l.id in (
      select c.id
      from public.email_log c
      where c.env = p_env
        and (
          c.status = 'queued'
          or (c.status = 'sending' and c.attempts < 3 and c.updated_at < now() - interval '15 minutes')
        )
      order by c.priority, c.created_at
      limit least(greatest(coalesce(p_limit, 10), 1), 50)
      for update skip locked
    )
    returning l.*
  )
  select * from claimed order by priority, created_at;
end;
$$;

-- Records what Resend said when the drain sent an email: sent with its
-- Resend ID, or failed with the error. A webhook may already have moved it
-- further, and that status stays.
create function public.email_mark(
  p_id uuid,
  p_status public.email_status,
  p_resend_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.email_status;
begin
  if p_status is null or p_status not in ('sent', 'failed') then
    raise exception 'Mark an email sent or failed.' using errcode = '22023';
  end if;

  if p_status = 'sent' and nullif(btrim(p_resend_id), '') is null then
    raise exception 'A sent email needs its Resend ID.' using errcode = '22023';
  end if;

  select status into v_status from public.email_log where id = p_id for update;

  if not found then
    raise exception 'That email doesn''t exist.' using errcode = 'P0002';
  end if;

  if v_status in ('skipped_quota', 'suppressed') then
    raise exception 'That email was never queued to send.' using errcode = '22023';
  end if;

  update public.email_log
  set
    status = greatest(status, p_status),
    resend_id = coalesce(resend_id, nullif(btrim(p_resend_id), '')),
    sent_at = case when p_status = 'sent' then coalesce(sent_at, now()) else sent_at end,
    error = case when p_status = 'failed' and status < 'failed' then left(p_error, 1000) else error end
  where id = p_id;
end;
$$;

-- Records a Resend webhook event: sent, delivered, failed, bounced, or
-- complained. Our own emails carry their log ID as a Resend tag, so an event
-- that beats email_mark() still finds its row. An event with no row is
-- Supabase Auth's own mail over SMTP, logged as a sign-in code. A bounce or
-- complaint suppresses the address.
create function public.email_record_webhook(
  p_resend_id text,
  p_status public.email_status,
  p_log_id uuid default null,
  p_to text default null,
  p_subject text default null,
  p_error text default null,
  p_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resend_id text := nullif(btrim(p_resend_id), '');
  v_id uuid;
  v_address text;
begin
  if p_status is null or p_status not in ('sent', 'delivered', 'failed', 'bounced', 'complained') then
    raise exception 'The webhook doesn''t take that status.' using errcode = '22023';
  end if;

  if v_resend_id is null then
    raise exception 'The event needs its Resend ID.' using errcode = '22023';
  end if;

  if p_log_id is not null then
    update public.email_log
    set resend_id = v_resend_id
    where id = p_log_id
      and resend_id is null
      and status not in ('skipped_quota', 'suppressed');
  end if;

  insert into public.email_log (
    resend_id, template, priority, scope, to_address, subject, status, error, sent_at, created_at
  ) values (
    v_resend_id, 'auth', 1, 'platform', left(lower(btrim(p_to)), 254), left(p_subject, 300), p_status,
    case when p_status in ('failed', 'bounced') then left(p_error, 1000) end,
    coalesce(p_at, now()), coalesce(p_at, now())
  )
  on conflict (resend_id) do update
  set
    status = greatest(email_log.status, excluded.status),
    sent_at = coalesce(email_log.sent_at, excluded.sent_at),
    error = case
      when excluded.status in ('failed', 'bounced') and excluded.status > email_log.status then excluded.error
      else email_log.error
    end
  returning id, coalesce(to_address, left(lower(btrim(p_to)), 254)) into v_id, v_address;

  if p_status in ('bounced', 'complained') and v_address is not null then
    insert into public.email_suppressions (address, reason, email_log_id)
    values (v_address, p_status::text, v_id)
    on conflict (address) do nothing;
  end if;
end;
$$;

revoke execute on function public.email_reserve(text, integer, text, text, text, text, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.email_claim(text, integer) from public, anon, authenticated;
revoke execute on function public.email_mark(uuid, public.email_status, text, text) from public, anon, authenticated;
revoke execute on function public.email_record_webhook(text, public.email_status, uuid, text, text, text, timestamptz)
  from public, anon, authenticated;

grant execute on function public.email_reserve(text, integer, text, text, text, text, text, uuid) to service_role;
grant execute on function public.email_claim(text, integer) to service_role;
grant execute on function public.email_mark(uuid, public.email_status, text, text) to service_role;
grant execute on function public.email_record_webhook(text, public.email_status, uuid, text, text, text, timestamptz)
  to service_role;

-- Owners start sending to a suppressed address again, say after someone
-- fixes a full mailbox.
create function public.email_unsuppress(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'Only an owner can start sending to an address again.' using errcode = '42501';
  end if;

  delete from public.email_suppressions where id = p_id;

  if not found then
    raise exception 'That address isn''t suppressed.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.email_unsuppress(uuid) from public, anon;
grant execute on function public.email_unsuppress(uuid) to authenticated;
