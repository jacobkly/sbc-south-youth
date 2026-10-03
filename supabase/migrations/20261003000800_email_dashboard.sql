-- The owner's Email screen, and the warning owners get once the month's
-- emails pass 80% of the free plan.
--
-- email_summary() gives the screen its counts. Recent failures and the
-- blocked addresses come straight from email_log and email_suppressions,
-- which owners already read.

-- Emails counted toward Resend's free plan over the last 24 hours and the
-- last 31 days, the same windows email_reserve() checks, and the last 31
-- days of emails by template and status. Also when owners were warned this
-- month, if they were. Owners only.
create function public.email_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'Only an owner can see how much email is used.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'day', (
      select count(*)
      from public.email_log l
      where l.counts_toward_quota and l.created_at > now() - interval '24 hours'
    ),
    'month', (
      select count(*)
      from public.email_log l
      where l.counts_toward_quota and l.created_at > now() - interval '31 days'
    ),
    'templates', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('template', t.template, 'status', t.status, 'counted', t.counted, 'emails', t.emails)
          order by t.template, t.status, t.counted
        ),
        '[]'::jsonb
      )
      from (
        select l.template, l.status, l.counts_toward_quota as counted, count(*) as emails
        from public.email_log l
        where l.created_at > now() - interval '31 days'
        group by l.template, l.status, l.counts_toward_quota
      ) t
    ),
    'warned_at', (
      select max(l.created_at)
      from public.email_log l
      where l.template = 'quota-warning'
        and l.status <> 'skipped_quota'
        and date_trunc('month', l.created_at at time zone 'America/Los_Angeles')
          = date_trunc('month', now() at time zone 'America/Los_Angeles')
    )
  );
end;
$$;

revoke execute on function public.email_summary() from public, anon;
grant execute on function public.email_summary() to authenticated;

-- Emails every active owner once the last 31 days pass 80% of the 3,000 a
-- month Resend's free plan sends, at most once a calendar month in Los
-- Angeles. Returns how many it logged. A warning to a blocked address still
-- counts as this month's, but one the daily quota skipped tries again the
-- next morning. Its subject carries the count, so the email needs no other
-- details.
create function public.queue_quota_warning()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month integer;
  v_to text;
  v_logged integer := 0;
begin
  -- One check at a time, so two can't both warn.
  perform pg_advisory_xact_lock(hashtext('public.queue_quota_warning'));

  if exists (
    select 1
    from public.email_log l
    where l.template = 'quota-warning'
      and l.status <> 'skipped_quota'
      and date_trunc('month', l.created_at at time zone 'America/Los_Angeles')
        = date_trunc('month', now() at time zone 'America/Los_Angeles')
  ) then
    return 0;
  end if;

  select count(*)
  into v_month
  from public.email_log l
  where l.counts_toward_quota and l.created_at > now() - interval '31 days';

  if v_month < 2400 then
    return 0;
  end if;

  for v_to in
    select distinct lower(u.email)
    from public.users u
    where u.is_active
      and 'owner' = any (u.roles)
      and u.email like '_%@_%'
  loop
    perform public.email_reserve(
      'quota-warning', 2, v_to,
      to_char(v_month, 'FM999,999') || ' of 3,000 emails used this month',
      'platform', 'production'
    );
    v_logged := v_logged + 1;
  end loop;

  return v_logged;
end;
$$;

-- Only the morning job runs it, as the database owner.
revoke execute on function public.queue_quota_warning() from public, anon, authenticated, service_role;

-- Each morning, just before the daily digest. A queued warning pokes the
-- drain itself.
select cron.schedule('email-quota-warning', '55 14 * * *', 'select public.queue_quota_warning()');
