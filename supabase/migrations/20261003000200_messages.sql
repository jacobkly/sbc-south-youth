-- Messages from the public site's forms: Plan a visit, Join the chat, Serve,
-- and Contact, which also takes photo takedown requests.
--
-- The site's server saves each one with the secret key through
-- site.submit_message(), which checks it again, holds each sender to 5 an
-- hour by a hash of their address, and queues an alert email. Nothing else
-- writes messages, and the secret key can't read them back. People with the
-- Messages role read them through RLS and change them only through
-- site.triage_message(). The activity log keeps each change of status,
-- outcome, and assignment, and never what the sender or a leader wrote.
--
-- Handled messages go after 12 months and spam after 30 days. Open messages
-- stay until someone closes them. Rate-limit rows go after 24 hours.

create type site.message_kind as enum ('visit', 'join', 'serve', 'contact', 'takedown');
create type site.message_status as enum ('new', 'in_progress', 'handled', 'spam');
-- How a serve request went: placed on a team, or not right now.
create type site.serve_outcome as enum ('placed', 'not_now');

create table site.messages (
  id uuid primary key default gen_random_uuid(),
  kind site.message_kind not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  email text check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+$'),
  phone text check (char_length(phone) <= 25),
  message text check (char_length(message) <= 2000),
  -- What only some forms ask: the Contact role, the Join band, and the Serve
  -- areas.
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  -- Staging shares the database, so its test messages say where they came from.
  env text not null default 'production' check (env in ('production', 'staging')),
  status site.message_status not null default 'new',
  outcome site.serve_outcome,
  assigned_to uuid references public.users (id) on delete set null,
  internal_note text check (char_length(internal_note) <= 2000),
  -- Who closed it, as handled or spam, and when. Retention counts from here.
  handled_by uuid references public.users (id) on delete set null,
  handled_at timestamptz,
  -- When Resend took the alert. Until then, the daily digest lists it.
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (outcome is null or kind = 'serve'),
  check ((status in ('handled', 'spam')) = (handled_at is not null)),
  check (email is not null or phone is not null),
  check (kind not in ('contact', 'takedown') or email is not null)
);

comment on table site.messages is
  'Form messages. Saved only by site.submit_message(), read by the Messages role, changed only by site.triage_message().';

create index messages_status_created_at_idx on site.messages (status, created_at desc);
create index messages_not_notified_idx on site.messages (created_at) where notified_at is null;

-- One row for each saved message, by a salted hash of the sender's address,
-- never the address itself.
create table site.form_rate_limits (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

comment on table site.form_rate_limits is 'Recent form messages by hashed address. Only site.submit_message() reads or writes it.';

create index form_rate_limits_ip_hash_idx on site.form_rate_limits (ip_hash, created_at);

alter table site.messages enable row level security;
alter table site.form_rate_limits enable row level security;

-- Signed-in people only read, and only the Messages role sees anything. No
-- client reaches the rate limits, not even with the secret key.
revoke all on table site.messages, site.form_rate_limits from public, anon, authenticated, service_role;
grant select on table site.messages to authenticated;

create policy "The Messages role reads messages"
  on site.messages for select
  to authenticated
  using ((select public.has_role('site_messages')));

create trigger set_updated_at
  before update on site.messages
  for each row execute function public.set_updated_at();

-- New messages aren't logged, and neither is a change to the note alone. The
-- kind names the row, so the log never holds the sender's name.
create trigger log_activity
  after update of status, outcome, assigned_to on site.messages
  for each row execute function public.log_activity('site', 'message', 'kind', 'status', 'outcome', 'assigned_to');

-- Saves a form message for the site's server, which has already checked the
-- form, its bot protection, and the sender's address. This checks the fields
-- again, keeps only the ones the form takes, and refuses a 6th message in an
-- hour from the same hashed address with HTTP 429.
--
-- p_payload holds name, email, phone, message, role (contact and takedown),
-- band (join), and areas (serve). Other keys are ignored. With p_alert_to,
-- it queues the alert there. A full outbox never stops the message saving,
-- and the daily digest lists any alert that didn't go.
create function site.submit_message(
  p_kind site.message_kind,
  p_payload jsonb,
  p_ip_hash text,
  p_env text,
  p_alert_to text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_space constant text := E' \t\r\n';
  v_name text := nullif(btrim(p_payload ->> 'name', v_space), '');
  v_email text := nullif(btrim(p_payload ->> 'email', v_space), '');
  v_phone text := nullif(btrim(p_payload ->> 'phone', v_space), '');
  v_message text;
  v_limit integer;
  v_role text;
  v_band text;
  v_areas jsonb;
  v_details jsonb := '{}';
  v_alert_to text := nullif(btrim(p_alert_to), '');
  v_first text;
  v_id uuid;
begin
  if p_kind is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Send the kind of message and its fields.' using errcode = '22023';
  end if;

  if p_env is null or p_env not in ('production', 'staging') then
    raise exception 'A message comes from production or staging.' using errcode = '22023';
  end if;

  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Send a hash of the sender''s address, never the address.' using errcode = '22023';
  end if;

  if v_name is null then
    raise exception 'Add a name.' using errcode = '22023';
  end if;

  if char_length(v_name) > 80 then
    raise exception 'Keep the name under 80 characters.' using errcode = '22023';
  end if;

  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+$') then
    raise exception 'That email doesn''t look right.' using errcode = '22023';
  end if;

  if char_length(v_phone) > 25 then
    raise exception 'That phone number doesn''t look right.' using errcode = '22023';
  end if;

  -- Join takes no message. Visit and Serve take a short note.
  if p_kind <> 'join' then
    v_message := nullif(btrim(p_payload ->> 'message', v_space), '');
    v_limit := case when p_kind in ('visit', 'serve') then 500 else 2000 end;
    if char_length(v_message) > v_limit then
      raise exception 'Keep the message under % characters.', v_limit using errcode = '22023';
    end if;
  end if;

  if p_kind in ('contact', 'takedown') then
    if v_email is null then
      raise exception 'Add an email so we can write back.' using errcode = '22023';
    end if;
    if v_message is null then
      raise exception 'Write a message.' using errcode = '22023';
    end if;

    v_role := nullif(btrim(p_payload ->> 'role', v_space), '');
    if v_role is not null then
      if v_role not in ('student', 'parent', 'other') then
        raise exception 'Choose student, parent, or other.' using errcode = '22023';
      end if;
      v_details := jsonb_build_object('role', v_role);
    end if;
  elsif v_email is null and v_phone is null then
    raise exception 'Add an email or a phone number.' using errcode = '22023';
  end if;

  if p_kind = 'join' then
    v_band := nullif(btrim(p_payload ->> 'band', v_space), '');
    if v_band is not null then
      if v_band not in ('hs', 'college', 'not-in-school') then
        raise exception 'Choose high school, college, or not in school.' using errcode = '22023';
      end if;
      v_details := jsonb_build_object('band', v_band);
    end if;
  end if;

  if p_kind = 'serve' then
    v_areas := p_payload -> 'areas';
    if jsonb_typeof(v_areas) is distinct from 'array' or jsonb_array_length(v_areas) = 0 then
      raise exception 'Choose at least one way to serve.' using errcode = '22023';
    end if;
    if jsonb_array_length(v_areas) > 10
      or exists (
        select 1 from jsonb_array_elements(v_areas) a
        where jsonb_typeof(a) <> 'string' or a #>> '{}' !~ '^[a-z0-9-]{1,40}$'
      )
      or (select count(distinct a) from jsonb_array_elements(v_areas) a) <> jsonb_array_length(v_areas)
    then
      raise exception 'Choose ways to serve from the list.' using errcode = '22023';
    end if;
    v_details := jsonb_build_object('areas', v_areas);
  end if;

  -- One sender at a time, so two messages at once can't both take the 5th place.
  perform pg_advisory_xact_lock(hashtext('site.submit_message'), hashtext(p_ip_hash));

  if (
    select count(*) from site.form_rate_limits r
    where r.ip_hash = p_ip_hash and r.created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'You''ve sent a few messages already. Try again in an hour.' using errcode = 'PT429';
  end if;

  insert into site.form_rate_limits (ip_hash) values (p_ip_hash);

  insert into site.messages (kind, name, email, phone, message, details, env)
  values (p_kind, v_name, v_email, v_phone, v_message, v_details, p_env)
  returning id into v_id;

  if v_alert_to is not null then
    -- Only the kind and first name go in the subject, which inboxes show
    -- before anyone opens it.
    v_first := (regexp_split_to_array(v_name, '\s+'))[1];
    begin
      perform public.email_reserve(
        'form-alert',
        4,
        v_alert_to,
        v_first || case p_kind
          when 'visit' then ' is planning a visit'
          when 'join' then ' wants to join the chat'
          when 'serve' then ' wants to serve'
          when 'contact' then ' sent a message'
          when 'takedown' then ' asked to take down a photo'
        end,
        'site',
        p_env,
        'message',
        v_id
      );
    exception when others then
      raise warning 'Couldn''t queue the alert for message %: %', v_id, sqlerrm;
    end;
  end if;

  return v_id;
end;
$$;

revoke execute on function site.submit_message(site.message_kind, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function site.submit_message(site.message_kind, jsonb, text, text, text) to service_role;

-- Changes a message's triage fields for the Messages role. p_changes holds
-- only what changes: status, outcome (serve only), assigned_to (a leader
-- with Messages, or null), and internal_note (blank clears it). What the
-- sender wrote never changes. Closing a message as handled or spam records
-- who and when, and opening it again clears them.
create function site.triage_message(p_id uuid, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row site.messages;
  v_status site.message_status;
  v_outcome site.serve_outcome;
  v_assigned_to uuid;
  v_note text;
begin
  if not (select public.has_role('site_messages')) then
    raise exception 'Only someone with Messages can change a message.' using errcode = '42501';
  end if;

  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'
    or exists (
      select 1 from jsonb_object_keys(p_changes) k
      where k not in ('status', 'outcome', 'assigned_to', 'internal_note')
    )
  then
    raise exception 'Change the status, outcome, assignment, or note.' using errcode = '22023';
  end if;

  select * into v_row from site.messages where id = p_id for update;

  if not found then
    raise exception 'That message doesn''t exist.' using errcode = 'P0002';
  end if;

  v_status := v_row.status;
  v_outcome := v_row.outcome;
  v_assigned_to := v_row.assigned_to;
  v_note := v_row.internal_note;

  begin
    if p_changes ? 'status' then
      v_status := (p_changes ->> 'status')::site.message_status;
      if v_status is null then
        raise exception 'Choose a status.' using errcode = '22023';
      end if;
    end if;

    if p_changes ? 'outcome' then
      v_outcome := (p_changes ->> 'outcome')::site.serve_outcome;
    end if;

    if p_changes ? 'assigned_to' then
      v_assigned_to := (p_changes ->> 'assigned_to')::uuid;
    end if;
  exception when invalid_text_representation then
    raise exception 'Choose a status, outcome, or leader from the list.' using errcode = '22023';
  end;

  if v_outcome is not null and v_row.kind <> 'serve' then
    raise exception 'Only a serve message has an outcome.' using errcode = '22023';
  end if;

  if p_changes ? 'assigned_to' and v_assigned_to is not null and not exists (
    select 1 from public.users u
    where u.id = v_assigned_to
      and u.is_active
      and u.roles && array['owner', 'site_messages']::public.app_role[]
  ) then
    raise exception 'Assign it to a leader with Messages.' using errcode = '22023';
  end if;

  if p_changes ? 'internal_note' then
    v_note := nullif(btrim(p_changes ->> 'internal_note', E' \t\r\n'), '');
    if char_length(v_note) > 2000 then
      raise exception 'Keep the note under 2,000 characters.' using errcode = '22023';
    end if;
  end if;

  update site.messages
  set
    status = v_status,
    outcome = v_outcome,
    assigned_to = v_assigned_to,
    internal_note = v_note,
    handled_by = case
      when v_status not in ('handled', 'spam') then null
      when v_status = v_row.status then v_row.handled_by
      else auth.uid()
    end,
    handled_at = case
      when v_status not in ('handled', 'spam') then null
      when v_status = v_row.status then v_row.handled_at
      else now()
    end
  where id = p_id;
end;
$$;

revoke execute on function site.triage_message(uuid, jsonb) from public, anon, service_role;
grant execute on function site.triage_message(uuid, jsonb) to authenticated;

-- Marks a message notified once Resend takes its alert. A failed alert
-- leaves it for the daily digest.
create function site.mark_message_notified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update site.messages
  set notified_at = coalesce(new.sent_at, now())
  where id = new.related_id and notified_at is null;
  return null;
end;
$$;

revoke execute on function site.mark_message_notified() from public, anon, authenticated, service_role;

create trigger mark_message_notified
  after update of status on public.email_log
  for each row
  when (
    new.template = 'form-alert'
    and new.related_type = 'message'
    and new.resend_id is not null
    and new.status in ('sent', 'delivered')
  )
  execute function site.mark_message_notified();

-- Removes handled messages after 12 months and spam after 30 days, counted
-- from when they were closed, and returns how many went.
create function site.prune_messages()
returns integer
language sql
set search_path = ''
as $$
  with pruned as (
    delete from site.messages
    where (status = 'handled' and handled_at < now() - interval '12 months')
       or (status = 'spam' and handled_at < now() - interval '30 days')
    returning 1
  )
  select count(*)::integer from pruned;
$$;

-- Removes rate-limit rows older than 24 hours, and returns how many went.
create function site.prune_form_rate_limits()
returns integer
language sql
set search_path = ''
as $$
  with pruned as (
    delete from site.form_rate_limits
    where created_at < now() - interval '24 hours'
    returning 1
  )
  select count(*)::integer from pruned;
$$;

revoke execute on function site.prune_messages() from public, anon, authenticated, service_role;
revoke execute on function site.prune_form_rate_limits() from public, anon, authenticated, service_role;

-- Times are UTC, after the other nightly jobs.
select cron.schedule('prune-messages', '15 10 * * *', 'select site.prune_messages()');
select cron.schedule('prune-form-rate-limits', '20 10 * * *', 'select site.prune_form_rate_limits()');
