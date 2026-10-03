-- People: invites, removing and reinstating access, last seen, and a
-- directory of names and pictures.
--
-- An owner's server action creates the account with the secret key, then
-- everything else runs as the owner: set_roles(), then record_invite(),
-- which keeps one invite per person and counts resends. The person's first
-- visit accepts it. Removing access only turns is_active off, so every
-- has_role() check fails on the next query and reinstating is one step; the
-- server action also bans the account so its sign-in can't be refreshed.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  -- The address and name the invite went to, and the roles it gave.
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  full_name text not null check (char_length(full_name) <= 100),
  roles public.app_role[] not null check (cardinality(roles) > 0),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  invited_by uuid references public.users (id) on delete set null,
  sent_count integer not null default 1 check (sent_count > 0),
  last_sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invites_accepted_at check ((status = 'accepted') = (accepted_at is not null))
);

comment on table public.invites is
  'One invite per person, from record_invite(). Accepted on their first visit through accept_invite().';

create index invites_invited_by_idx on public.invites (invited_by);

create trigger set_updated_at
  before update on public.invites
  for each row execute function public.set_updated_at();

alter table public.invites enable row level security;

-- Owners read invites. Nobody writes them directly, not even with the secret key.
revoke all on table public.invites from anon, authenticated, service_role;
grant select on table public.invites to authenticated;

create policy "Owners read invites"
  on public.invites for select
  to authenticated
  using ((select public.has_role('owner')));

-- The email stays out of the log.
create trigger log_activity
  after insert or update or delete on public.invites
  for each row execute function public.log_activity('platform', 'invite', 'full_name', 'roles', 'status', 'sent_count');

-- Records an invite for someone whose account and roles are already set, or
-- counts a resend of their pending one. Returns the invite.
create function public.record_invite(p_user_id uuid)
returns public.invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.users;
  v_invite public.invites;
begin
  if not public.has_role('owner') then
    raise exception 'Only an owner can invite people.' using errcode = '42501';
  end if;

  select * into v_user from public.users u where u.id = p_user_id;
  if not found then
    raise exception 'That person doesn''t exist.' using errcode = 'P0002';
  end if;

  if not v_user.is_active then
    raise exception 'Reinstate them before sending an invite.' using errcode = '55000';
  end if;

  if cardinality(v_user.roles) = 0 then
    raise exception 'Give them at least one role first.' using errcode = '22023';
  end if;

  insert into public.invites as i (user_id, email, full_name, roles, invited_by)
  values (v_user.id, lower(btrim(v_user.email)), v_user.full_name, v_user.roles, auth.uid())
  on conflict (user_id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        roles = excluded.roles,
        sent_count = i.sent_count + 1,
        last_sent_at = now()
    where i.status = 'pending'
  returning * into v_invite;

  if not found then
    raise exception 'They''ve already accepted their invite.' using errcode = '55000';
  end if;

  return v_invite;
end;
$$;

revoke execute on function public.record_invite(uuid) from public, anon;
grant execute on function public.record_invite(uuid) to authenticated;

-- Accepts the caller's own pending invite. True when there was one.
create function public.accept_invite()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invites i
  set status = 'accepted', accepted_at = now()
  where i.user_id = auth.uid()
    and i.status = 'pending'
    and exists (select 1 from public.users u where u.id = i.user_id and u.is_active);

  return found;
end;
$$;

revoke execute on function public.accept_invite() from public, anon;
grant execute on function public.accept_invite() to authenticated;

-- Takes away all of someone's access and keeps their roles for reinstating.
-- Removing access that's already gone does nothing, so a failed ban can be
-- retried. keep_an_owner() stops the last active owner from being removed.
create function public.remove_access(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'Only an owner can remove access.' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You can''t remove your own access.' using errcode = '42501';
  end if;

  perform 1 from public.users u where u.id = p_user_id;
  if not found then
    raise exception 'That person doesn''t exist.' using errcode = 'P0002';
  end if;

  update public.users
  set is_active = false, updated_by = auth.uid()
  where id = p_user_id and is_active;
end;
$$;

revoke execute on function public.remove_access(uuid) from public, anon;
grant execute on function public.remove_access(uuid) to authenticated;

-- Gives someone back the access they had, with the roles they kept.
create function public.reinstate(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'Only an owner can reinstate people.' using errcode = '42501';
  end if;

  perform 1 from public.users u where u.id = p_user_id;
  if not found then
    raise exception 'That person doesn''t exist.' using errcode = 'P0002';
  end if;

  update public.users
  set is_active = true, updated_by = auth.uid()
  where id = p_user_id and not is_active;
end;
$$;

revoke execute on function public.reinstate(uuid) from public, anon;
grant execute on function public.reinstate(uuid) to authenticated;

-- Marks the caller as seen, at most once an hour, and logs one sign-in a day
-- (by the day in Los Angeles). Supabase keeps its own sign-in history for
-- only an hour on the free plan. True when it wrote.
create function public.touch_last_seen()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  update public.users u
  set last_seen_at = now()
  where u.id = auth.uid()
    and u.is_active
    and (u.last_seen_at is null or u.last_seen_at <= now() - interval '1 hour')
  returning u.full_name into v_name;

  if not found then
    return false;
  end if;

  if not exists (
    select 1 from public.activity_log a
    where a.actor_id = auth.uid()
      and a.action = 'auth.signed_in'
      and a.created_at >= date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles'
  ) then
    insert into public.activity_log (actor_id, scope, action, entity_type, entity_id, entity_name)
    values (auth.uid(), 'platform', 'auth.signed_in', 'user', auth.uid()::text, v_name);
  end if;

  return true;
end;
$$;

revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

-- Everyone's name and picture, for showing who did something or who's
-- assigned. Any portal role may read it. It never returns emails, so site
-- roles can see who's who without reading users.
create function public.people_directory()
returns table (id uuid, full_name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.full_name, u.avatar_path
  from public.users u
  where (select public.has_role('finance_viewer', 'site_editor', 'site_messages'))
  order by u.full_name, u.id
$$;

revoke execute on function public.people_directory() from public, anon;
grant execute on function public.people_directory() to authenticated;

-- The pictures in that directory load for the same people. Policies on
-- storage tables can be dropped and created but not altered.
drop policy "Avatars are readable by their owner, admins, and viewers" on storage.objects;

create policy "Avatars are readable by their owner and portal roles"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (select public.has_role('finance_viewer', 'site_editor', 'site_messages'))
      or (
        (select public.current_app_role()) is not null
        and (storage.foldername(objects.name))[1] = (select auth.uid())::text
      )
    )
  );
