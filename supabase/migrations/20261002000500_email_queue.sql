-- Emails the database queues by itself, and the poke that gets them sent.
--
-- Request status changes and owner changes queue emails through
-- email_reserve(). A transaction that queues one pokes the drain on the
-- portal host once, through pg_net after it commits, with the URL and shared
-- secret kept in Vault. A nightly pg_cron job pokes it for the daily digest.
-- An email never blocks the change behind it: a failure is a warning, and a
-- queued row waits for the next poke.
--
-- Installing pg_net lets the API roles call net.http_post and read its queue,
-- and only the extension's owner could take that back. The API serves only
-- the public and graphql_public schemas, so they can't reach either.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- Asks the drain to send what's queued, or with p_digest, to send the daily
-- digest. Vault holds email_drain_url and email_drain_secret, plus an
-- optional email_drain_host for when the URL can't name the portal host, as
-- locally. Without them it does nothing. One poke drains everything a
-- transaction queued, so later calls in the same one return null.
create function public.email_poke_drain(p_digest boolean default false)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_host text;
begin
  if not p_digest and current_setting('app.email_drain_poked', true) = '1' then
    return null;
  end if;

  select
    max(s.decrypted_secret) filter (where s.name = 'email_drain_url'),
    max(s.decrypted_secret) filter (where s.name = 'email_drain_secret'),
    max(s.decrypted_secret) filter (where s.name = 'email_drain_host')
  into v_url, v_secret, v_host
  from vault.decrypted_secrets s
  where s.name in ('email_drain_url', 'email_drain_secret', 'email_drain_host');

  if v_url is null or v_secret is null then
    return null;
  end if;

  if not p_digest then
    perform set_config('app.email_drain_poked', '1', true);
  end if;

  return net.http_post(
    url => v_url,
    body => '{}'::jsonb,
    params => case when p_digest then '{"digest": "1"}'::jsonb else '{}'::jsonb end,
    headers => jsonb_strip_nulls(jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret,
      'Host', v_host
    )),
    timeout_milliseconds => 30000
  );
end;
$$;

-- Only the database pokes the drain: these triggers and the nightly job.
revoke execute on function public.email_poke_drain(boolean) from public, anon, authenticated, service_role;

create function public.email_queued()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.email_poke_drain();
  return null;
exception when others then
  raise warning 'Couldn''t poke the email drain: %', sqlerrm;
  return null;
end;
$$;

revoke execute on function public.email_queued() from public, anon, authenticated;

create trigger poke_drain
  after insert on public.email_log
  for each row
  when (new.status = 'queued')
  execute function public.email_queued();

-- Submitted (or resubmitted) requests go to every active owner but the one
-- who submitted it. Asking for more info and paying an approved request go to
-- the person the payee is linked to, if they can follow it in My requests.
-- Approval sends nothing, and neither does taking an approval back, nor a
-- payment recorded from a draft, which is a record of the past.
create function public.queue_request_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number text := 'R-' || lpad(new.request_number::text, 4, '0');
  v_to text;
begin
  if new.status = 'submitted' and old.status in ('draft', 'needs_info') then
    for v_to in
      select u.email
      from public.users u
      where u.is_active
        and 'owner' = any (u.roles)
        and u.id is distinct from auth.uid()
        and u.email like '_%@_%'
    loop
      perform public.email_reserve(
        'request-submitted', 3, v_to,
        v_number || case when old.status = 'needs_info' then ' was resubmitted' else ' is ready for review' end,
        'finances', 'production', 'reimbursement_request', new.id
      );
    end loop;
  elsif new.status = 'needs_info' or (new.status = 'paid' and old.status = 'approved') then
    select u.email
    into v_to
    from public.payees p
    join public.users u on u.id = p.user_id
    where p.id = new.payee_id
      and u.is_active
      and u.roles && '{owner,finance_requester}'::public.app_role[]
      and u.id is distinct from auth.uid()
      and u.email like '_%@_%';

    if v_to is not null then
      perform public.email_reserve(
        case when new.status = 'paid' then 'request-paid' else 'request-returned' end, 3, v_to,
        'Your request ' || v_number || case when new.status = 'paid' then ' was paid' else ' needs more info' end,
        'finances', 'production', 'reimbursement_request', new.id
      );
    end if;
  end if;

  return null;
exception when others then
  raise warning 'Couldn''t queue an email for request %: %', new.id, sqlerrm;
  return null;
end;
$$;

revoke execute on function public.queue_request_emails() from public, anon, authenticated;

create trigger queue_emails
  after update of status on public.reimbursement_requests
  for each row
  when (old.status is distinct from new.status)
  execute function public.queue_request_emails();

-- Gaining or losing Owner, including through removed or restored access,
-- emails every active owner and the person who lost it, so a change made from
-- a stolen account doesn't go unnoticed.
create function public.queue_owner_alerts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was boolean := tg_op = 'UPDATE' and old.is_active and 'owner' = any (old.roles);
  v_is boolean := new.is_active and 'owner' = any (new.roles);
  v_subject text;
  v_to text;
begin
  if v_was = v_is then
    return null;
  end if;

  v_subject := coalesce(nullif(btrim(new.full_name), ''), 'Someone')
    || case when v_is then ' is now an owner' else ' is no longer an owner' end;

  for v_to in
    select distinct lower(u.email)
    from public.users u
    where ((u.is_active and 'owner' = any (u.roles)) or u.id = new.id)
      and u.email like '_%@_%'
  loop
    perform public.email_reserve('owner-changed', 2, v_to, v_subject, 'platform', 'production', 'user', new.id);
  end loop;

  return null;
exception when others then
  raise warning 'Couldn''t queue the owner alerts for user %: %', new.id, sqlerrm;
  return null;
end;
$$;

revoke execute on function public.queue_owner_alerts() from public, anon, authenticated;

-- "update of role" covers older code that changes only the single role,
-- which then changes roles.
create trigger queue_owner_alerts
  after insert or update of role, roles, is_active on public.users
  for each row execute function public.queue_owner_alerts();

-- The daily digest at 15:00 UTC: 8 AM in Los Angeles in summer, 7 in winter.
select cron.schedule('email-daily-digest', '0 15 * * *', 'select public.email_poke_drain(true)');
