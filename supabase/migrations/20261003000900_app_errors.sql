-- The owners' error log. Vercel's free plan keeps runtime logs for only a
-- short time, so the site's server also writes each unexpected error here:
-- where it happened, one line of message, and who hit it. Owners see the
-- newest on their Home, and rows go after 30 days.
--
-- Only the server writes, through report_error(), which only service_role
-- can execute. The site cuts stacks and hides email addresses and phone
-- numbers before it gets here.

create table public.app_errors (
  id uuid primary key default gen_random_uuid(),
  -- Where it happened, like "Save a photo" or "Portal page /events/[id]".
  source text not null check (char_length(source) between 1 and 200),
  message text not null check (char_length(message) between 1 and 500),
  -- A Postgres or system code, or the digest React gives a page error.
  code text check (char_length(code) between 1 and 20),
  user_id uuid references public.users (id) on delete set null,
  env text not null default 'production' check (env in ('production', 'staging')),
  created_at timestamptz not null default now()
);

create index app_errors_created_at_idx on public.app_errors (created_at desc);
create index app_errors_user_id_idx on public.app_errors (user_id) where user_id is not null;

alter table public.app_errors enable row level security;

revoke all on table public.app_errors from anon, authenticated, service_role;
grant select on table public.app_errors to authenticated;

create policy "Owners read app errors" on public.app_errors for select to authenticated
  using ((select public.has_role('owner')));

-- Writes one error and returns true, or false once the last hour already
-- has 100, so a loop of failures can't fill the free database. A person
-- who no longer has a row is left out rather than failing the write.
create function public.report_error(
  p_source text,
  p_message text,
  p_code text default null,
  p_user_id uuid default null,
  p_env text default 'production'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_env is null or p_env not in ('production', 'staging') then
    raise exception 'Say whether the error came from production or staging.' using errcode = '22023';
  end if;

  if (select count(*) from public.app_errors e where e.created_at > now() - interval '1 hour') >= 100 then
    return false;
  end if;

  insert into public.app_errors (source, message, code, user_id, env)
  values (
    coalesce(left(nullif(btrim(p_source), ''), 200), 'Unknown'),
    coalesce(left(nullif(btrim(p_message), ''), 500), 'No error message'),
    left(nullif(btrim(p_code), ''), 20),
    (select u.id from public.users u where u.id = p_user_id),
    p_env
  );
  return true;
end;
$$;

revoke execute on function public.report_error(text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.report_error(text, text, text, uuid, text) to service_role;

-- Removes errors older than 30 days, and returns how many went.
create function public.prune_app_errors()
returns integer
language sql
set search_path = ''
as $$
  with pruned as (
    delete from public.app_errors
    where created_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer from pruned;
$$;

revoke execute on function public.prune_app_errors() from public, anon, authenticated, service_role;

-- After the other nightly jobs, between 2 and 3 AM in Los Angeles.
select cron.schedule('prune-app-errors', '30 10 * * *', 'select public.prune_app_errors()');
