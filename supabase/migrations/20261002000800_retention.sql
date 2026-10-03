-- Nightly retention, so the logs keep only what's still useful and the
-- database stays inside the free plan.
--
-- Site and platform activity goes after 2 years. Finance activity and the
-- finance history in request_events are financial records and stay. Email
-- rows stay too, for quotas and history, but their addresses are cleared
-- after 90 days once the email is done. pg_cron's own run history goes after
-- 14 days.
--
-- Only the pg_cron jobs run these, as the database owner. No client can, not
-- even with the secret key.

-- Removes site and platform activity older than 2 years, and returns how
-- many rows went.
create function public.prune_old_activity()
returns integer
language sql
set search_path = ''
as $$
  with pruned as (
    delete from public.activity_log
    where scope in ('site', 'platform')
      and created_at < now() - interval '2 years'
    returning 1
  )
  select count(*)::integer from pruned;
$$;

-- Clears the address on emails older than 90 days, and returns how many it
-- cleared. An email still queued or sending keeps it so it can go out.
-- Suppressed addresses are a separate list and stay.
create function public.clear_old_email_addresses()
returns integer
language sql
set search_path = ''
as $$
  with cleared as (
    update public.email_log
    set to_address = null
    where to_address is not null
      and status not in ('queued', 'sending')
      and created_at < now() - interval '90 days'
    returning 1
  )
  select count(*)::integer from cleared;
$$;

-- Removes pg_cron run history that ended more than 14 days ago, and returns
-- how many runs went.
create function public.prune_cron_history()
returns integer
language sql
set search_path = ''
as $$
  with pruned as (
    delete from cron.job_run_details
    where end_time < now() - interval '14 days'
    returning 1
  )
  select count(*)::integer from pruned;
$$;

revoke execute on function public.prune_old_activity() from public, anon, authenticated, service_role;
revoke execute on function public.clear_old_email_addresses() from public, anon, authenticated, service_role;
revoke execute on function public.prune_cron_history() from public, anon, authenticated, service_role;

-- Between 2 and 3 AM in Los Angeles, before the 8 AM digest.
select cron.schedule('prune-old-activity', '0 10 * * *', 'select public.prune_old_activity()');
select cron.schedule('clear-old-email-addresses', '5 10 * * *', 'select public.clear_old_email_addresses()');
select cron.schedule('prune-cron-history', '10 10 * * *', 'select public.prune_cron_history()');
