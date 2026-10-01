-- Stacked roles for both apps.
--
-- Each person's roles are a list on their users row, so one person can hold
-- several. Policies and RPCs check them with has_role(), which also requires
-- the person to be active. Owner counts as every role.
--
-- users.role stays for now so the deployed finances app keeps working: a
-- trigger keeps it in step with roles, and current_app_role() maps roles back
-- to it for the older finance rules. Both go away once nothing reads them.

create type public.app_role as enum (
  'owner',
  'finance_viewer',
  'finance_requester',
  'site_editor',
  'site_messages'
);

comment on type public.app_role is
  'owner: everything in both apps, and the only role that invites people, changes roles, removes access, and approves or pays. '
  'finance_viewer: reads every submitted request, receipt, and report, and changes nothing. '
  'finance_requester: submits their own reimbursements and sees only their own requests. '
  'site_editor: posts heads-ups and events, and uploads, places, and takes down photos. '
  'site_messages: reads and handles the site''s form messages.';

alter table public.users
  add column roles public.app_role[] not null default '{}',
  add column last_seen_at timestamptz,
  add column created_by uuid references public.users (id) on delete set null,
  add column updated_by uuid references public.users (id) on delete set null;

comment on column public.users.roles is 'The person''s roles. Only owners change them, through set_roles().';

-- Carry today's single role over. Members get no roles.
update public.users
set roles = case role
  when 'admin' then array['owner']::public.app_role[]
  when 'viewer' then array['finance_viewer']::public.app_role[]
  else '{}'::public.app_role[]
end;

-- Keeps role and roles in step while both exist. A change to roles wins. A
-- change to only role (from older code) swaps the finance part of roles.
create function public.sync_user_roles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'UPDATE' and new.roles is not distinct from old.roles and new.role is distinct from old.role)
     or (tg_op = 'INSERT' and new.roles = '{}' and new.role <> 'member') then
    new.roles := array(
      select r from unnest(new.roles) as r where r not in ('owner', 'finance_viewer')
    ) || case new.role
      when 'admin' then array['owner']::public.app_role[]
      when 'viewer' then array['finance_viewer']::public.app_role[]
      else '{}'::public.app_role[]
    end;
  end if;

  new.roles := array(select distinct r from unnest(new.roles) as r order by r);
  new.role := case
    when 'owner' = any (new.roles) then 'admin'::public.user_role
    when 'finance_viewer' = any (new.roles) then 'viewer'::public.user_role
    else 'member'::public.user_role
  end;
  return new;
end;
$$;

revoke execute on function public.sync_user_roles() from public, anon, authenticated;

create trigger sync_user_roles
  before insert or update of role, roles on public.users
  for each row execute function public.sync_user_roles();

-- Never leave the apps without an active owner.
create function public.keep_an_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active and 'owner' = any (old.roles)
     and not (new.is_active and 'owner' = any (new.roles))
     and not exists (
       select 1 from public.users u
       where u.id <> new.id and u.is_active and 'owner' = any (u.roles)
     ) then
    raise exception 'There has to be at least one active owner.' using errcode = '42501';
  end if;
  return null;
end;
$$;

revoke execute on function public.keep_an_owner() from public, anon, authenticated;

-- Fires on every update, since older code changes role and the sync trigger
-- then changes roles, which an "update of roles" trigger wouldn't see.
create trigger keep_an_owner
  after update on public.users
  for each row execute function public.keep_an_owner();

-- True when the caller is active and holds any of the roles, or is an owner.
-- Security definer so policies on public.users can call it without recursion.
create function public.has_role(variadic p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select u.is_active and u.roles && (p_roles || 'owner'::public.app_role)
      from public.users u
      where u.id = auth.uid()
    ),
    false
  )
$$;

revoke execute on function public.has_role(public.app_role[]) from public, anon;
grant execute on function public.has_role(public.app_role[]) to authenticated;

-- The older single role, worked out from roles: owner is admin, finance
-- viewer is viewer, and any other active person is a member.
create or replace function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when 'owner' = any (u.roles) then 'admin'::public.user_role
    when 'finance_viewer' = any (u.roles) then 'viewer'::public.user_role
    else 'member'::public.user_role
  end
  from public.users u
  where u.id = auth.uid()
    and u.is_active
$$;

-- Owners set anyone's roles, including their own. keep_an_owner() stops the
-- last owner from giving up the role.
create function public.set_roles(p_user_id uuid, p_roles public.app_role[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'Only an owner can change roles.' using errcode = '42501';
  end if;

  if p_roles is null or array_position(p_roles, null) is not null then
    raise exception 'Choose the roles.' using errcode = '22023';
  end if;

  update public.users
  set roles = p_roles, updated_by = auth.uid()
  where id = p_user_id;

  if not found then
    raise exception 'That person doesn''t exist.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.set_roles(uuid, public.app_role[]) from public, anon;
grant execute on function public.set_roles(uuid, public.app_role[]) to authenticated;
