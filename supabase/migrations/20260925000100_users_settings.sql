-- Users, roles, and app settings.
--
-- public.users adds an app role to each auth user. Policies read it through
-- current_app_role(), never from user_metadata, which users can edit
-- themselves. Roles change only through set_member_role().
--
-- Postgres lets anyone execute a new function, and Supabase exposes every
-- function in public over the API. So each function revokes execute, then
-- grants it back to authenticated only if the app calls it.
--
-- Policies wrap auth.uid() and current_app_role() in a select so Postgres
-- runs them once per query instead of once per row.

create type public.user_role as enum ('member', 'admin', 'viewer');

-- Shared trigger function that keeps updated_at current on every table.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) <= 100),
  email text not null check (char_length(email) <= 254),
  role public.user_role not null default 'member',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Every new auth user gets a member row. The first admin is promoted by hand.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      100
    )
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The caller's role, or null when they have no row or are deactivated.
-- Security definer so policies on public.users can call it without recursion.
create function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from public.users u
  where u.id = auth.uid()
    and u.is_active
$$;

revoke execute on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

alter table public.users enable row level security;

revoke all on table public.users from anon, authenticated;
grant select on table public.users to authenticated;
grant update (full_name) on table public.users to authenticated;

create policy "Users read their own row; admins and viewers read all"
  on public.users for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select public.current_app_role()) in ('admin', 'viewer')
  );

create policy "Active users update their own name"
  on public.users for update
  to authenticated
  using (id = (select auth.uid()) and (select public.current_app_role()) is not null)
  with check (id = (select auth.uid()));

-- Admin-only member management. An admin can't demote or deactivate themselves,
-- so there is always at least one admin left.
create function public.set_member_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can change roles.' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You can''t change your own role.' using errcode = '42501';
  end if;

  if p_role is null then
    raise exception 'Choose a role.' using errcode = '22023';
  end if;

  update public.users
  set role = p_role
  where id = p_user_id;

  if not found then
    raise exception 'That user doesn''t exist.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.set_member_role(uuid, public.user_role) from public, anon;
grant execute on function public.set_member_role(uuid, public.user_role) to authenticated;

create function public.set_member_active(p_user_id uuid, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can activate or deactivate users.' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You can''t deactivate yourself.' using errcode = '42501';
  end if;

  if p_is_active is null then
    raise exception 'Choose active or inactive.' using errcode = '22023';
  end if;

  update public.users
  set is_active = p_is_active
  where id = p_user_id;

  if not found then
    raise exception 'That user doesn''t exist.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.set_member_active(uuid, boolean) from public, anon;
grant execute on function public.set_member_active(uuid, boolean) to authenticated;

-- App-wide settings. The id check keeps it to one row.

create table public.app_settings (
  id integer primary key default 1 check (id = 1),
  allow_external_approval boolean not null default true,
  late_submission_days integer not null default 60 check (late_submission_days between 1 and 3650),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (1);

create trigger set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

revoke all on table public.app_settings from anon, authenticated;
grant select on table public.app_settings to authenticated;
grant update (allow_external_approval, late_submission_days) on table public.app_settings to authenticated;

create policy "Admins and viewers read settings"
  on public.app_settings for select
  to authenticated
  using ((select public.current_app_role()) in ('admin', 'viewer'));

create policy "Admins update settings"
  on public.app_settings for update
  to authenticated
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');
