-- Owners hear when stored files fill up. Receipts, site photos, and profile
-- pictures share the free plan's 1 GB, and nobody watches Home every day,
-- so owners get an email while there's still time to make room.

-- Emails every active owner once stored files reach 80% of the free plan's
-- 1 GB, at most once a calendar month in Los Angeles, and again at 95%, where
-- new site photos stop (site.photo_uploads_open()). Once owners heard it's
-- nearly full, the 80% warning stays quiet for the rest of that month.
-- Returns how many it logged. A warning to a blocked address still counts as
-- this month's, but one the daily quota skipped tries again the next
-- morning. Its subject carries the percent, so the email needs no other
-- details. The percent rounds down, like Home's storage bar.
create function public.queue_storage_warning()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bytes bigint;
  v_percent integer;
  v_template text;
  v_to text;
  v_logged integer := 0;
begin
  -- One check at a time, so two can't both warn.
  perform pg_advisory_xact_lock(hashtext('public.queue_storage_warning'));

  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
  into v_bytes
  from storage.objects o;

  v_percent := floor(v_bytes * 100 / 1000000000.0)::integer;

  if v_percent < 80 then
    return 0;
  end if;

  v_template := case when v_percent >= 95 then 'storage-full' else 'storage-warning' end;

  if exists (
    select 1
    from public.email_log l
    where l.template in ('storage-full', v_template)
      and l.status <> 'skipped_quota'
      and date_trunc('month', l.created_at at time zone 'America/Los_Angeles')
        = date_trunc('month', now() at time zone 'America/Los_Angeles')
  ) then
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
      v_template, 2, v_to,
      'File storage is ' || v_percent || '% full',
      'platform', 'production'
    );
    v_logged := v_logged + 1;
  end loop;

  return v_logged;
end;
$$;

-- Only the morning job runs it, as the database owner.
revoke execute on function public.queue_storage_warning() from public, anon, authenticated, service_role;

-- Each morning, just before the email quota check. A queued warning pokes
-- the drain itself.
select cron.schedule('email-storage-warning', '50 14 * * *', 'select public.queue_storage_warning()');
