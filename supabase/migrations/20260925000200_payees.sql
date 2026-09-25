-- Payees: people who get reimbursed. Separate from user accounts, with an
-- optional one-to-one link to a user. Never deleted, only deactivated.

create table public.payees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 1 and 100),
  email text check (email is null or (char_length(email) <= 254 and email like '%_@_%')),
  payment_handle text check (payment_handle is null or char_length(payment_handle) <= 100),
  notes text check (notes is null or char_length(notes) <= 1000),
  user_id uuid unique references public.users (id),
  linked_by uuid references public.users (id),
  linked_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payees_link_consistent check ((user_id is null) = (linked_at is null))
);

create unique index payees_email_key on public.payees (lower(email)) where email is not null;
create index payees_linked_by_idx on public.payees (linked_by);

create trigger set_updated_at
  before update on public.payees
  for each row execute function public.set_updated_at();

-- The payee linked to the caller, or null.
create function public.current_payee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.payees p
  where p.user_id = auth.uid()
$$;

revoke execute on function public.current_payee_id() from public, anon;
grant execute on function public.current_payee_id() to authenticated;

alter table public.payees enable row level security;

-- Linking columns change only through link_payee() and unlink_payee().
revoke all on table public.payees from anon, authenticated;
grant select on table public.payees to authenticated;
grant insert (full_name, email, payment_handle, notes, is_active) on table public.payees to authenticated;
grant update (full_name, email, payment_handle, notes, is_active) on table public.payees to authenticated;

create policy "Admins and viewers read payees"
  on public.payees for select
  to authenticated
  using ((select public.current_app_role()) in ('admin', 'viewer'));

create policy "Admins add payees"
  on public.payees for insert
  to authenticated
  with check ((select public.current_app_role()) = 'admin');

create policy "Admins edit payees"
  on public.payees for update
  to authenticated
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');

create function public.link_payee(p_payee_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payee public.payees;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can link payees.' using errcode = '42501';
  end if;

  select * into v_payee
  from public.payees
  where id = p_payee_id
  for update;

  if not found then
    raise exception 'That payee doesn''t exist.' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.users u where u.id = p_user_id) then
    raise exception 'That user doesn''t exist.' using errcode = 'P0002';
  end if;

  if v_payee.user_id = p_user_id then
    return;
  end if;

  if v_payee.user_id is not null then
    raise exception 'This payee is already linked to another user. Unlink it first.' using errcode = '55000';
  end if;

  if exists (select 1 from public.payees p where p.user_id = p_user_id) then
    raise exception 'That user is already linked to another payee.' using errcode = '23505';
  end if;

  update public.payees
  set user_id = p_user_id,
      linked_by = auth.uid(),
      linked_at = now()
  where id = p_payee_id;
end;
$$;

revoke execute on function public.link_payee(uuid, uuid) from public, anon;
grant execute on function public.link_payee(uuid, uuid) to authenticated;

create function public.unlink_payee(p_payee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can unlink payees.' using errcode = '42501';
  end if;

  update public.payees
  set user_id = null,
      linked_by = null,
      linked_at = null
  where id = p_payee_id;

  if not found then
    raise exception 'That payee doesn''t exist.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.unlink_payee(uuid) from public, anon;
grant execute on function public.unlink_payee(uuid) to authenticated;
