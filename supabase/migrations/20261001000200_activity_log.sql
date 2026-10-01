-- One activity log for the site and the platform, plus a feed that adds the
-- finance history.
--
-- Rows are written only by the log_activity() trigger and the log_event()
-- RPC. People read rows by scope: site roles read site rows, finance viewers
-- read finance rows, and owners read everything. Finance history stays in
-- request_events, and activity_feed shows both, each under its own rules.

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users (id) on delete set null,
  scope text not null check (scope in ('site', 'finances', 'platform')),
  action text not null,
  entity_type text not null,
  entity_id text,
  -- The row's name when it happened, so the feed still reads after a rename
  -- or delete.
  entity_name text,
  changes jsonb,
  created_at timestamptz not null default now()
);

comment on table public.activity_log is
  'Who changed what on the site and the platform. Written only by log_activity() and log_event().';

create index activity_log_created_at_idx on public.activity_log (created_at desc, id desc);
create index activity_log_actor_id_idx on public.activity_log (actor_id);

alter table public.activity_log enable row level security;

-- No client writes at all, not even with the secret key.
revoke all on table public.activity_log from anon, authenticated;
revoke insert, update, delete, truncate on table public.activity_log from service_role;
grant select on table public.activity_log to authenticated;

create policy "Activity is readable by scope"
  on public.activity_log for select
  to authenticated
  using (
    case scope
      when 'site' then (select public.has_role('site_editor', 'site_messages'))
      when 'finances' then (select public.has_role('finance_viewer'))
      when 'platform' then (select public.has_role('owner'))
      else false
    end
  );

-- Logs an insert, update, or delete on an audited table. Trigger arguments:
-- the scope, the entity type, the column that names the row ('' for none),
-- then the columns whose changes are logged. No other column reaches the log,
-- so message text, emails, and phone numbers stay out unless listed. An
-- update that changes none of the listed columns isn't logged.
--
-- The actor is the signed-in person. With no one signed in, as with the
-- secret key, it's whoever the write sets as updated_by. A write that leaves
-- updated_by as it was names no one, rather than the last person to set it.
create function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_changes jsonb;
  v_actor uuid;
begin
  if tg_op <> 'INSERT' then
    v_old := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    v_new := to_jsonb(new);
  end if;
  v_row := coalesce(v_new, v_old);

  select jsonb_object_agg(f.field, jsonb_build_object('from', v_old -> f.field, 'to', v_new -> f.field))
  into v_changes
  from unnest(tg_argv[3:]) as f (field)
  where v_old -> f.field is distinct from v_new -> f.field;

  if tg_op = 'UPDATE' and v_changes is null then
    return null;
  end if;

  v_actor := coalesce(
    auth.uid(),
    case
      when tg_op = 'INSERT' then coalesce(v_new ->> 'updated_by', v_new ->> 'created_by')::uuid
      when tg_op = 'UPDATE' and v_new -> 'updated_by' is distinct from v_old -> 'updated_by'
        then (v_new ->> 'updated_by')::uuid
    end
  );

  insert into public.activity_log (actor_id, scope, action, entity_type, entity_id, entity_name, changes)
  values (
    v_actor,
    tg_argv[0],
    tg_argv[1] || '.' || case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    tg_argv[1],
    v_row ->> 'id',
    case when tg_argv[2] <> '' then v_row ->> tg_argv[2] end,
    v_changes
  );

  return null;
end;
$$;

revoke execute on function public.log_activity() from public, anon, authenticated;

-- Accounts, roles, and removed access. "update of role" covers older code
-- that changes only the single role, which then changes roles.
create trigger log_activity
  after insert or update of role, roles, is_active or delete on public.users
  for each row execute function public.log_activity('platform', 'user', 'full_name', 'roles', 'is_active');

-- Logs something that has no row of its own behind it, like a download. Each
-- action on the list has its scope and the roles that may log it.
create function public.log_event(p_action text, p_entity_id text default null, p_entity_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope text;
  v_allowed boolean;
begin
  case p_action
    when 'export.downloaded' then
      v_scope := 'finances';
      v_allowed := public.has_role('finance_viewer');
    when 'activity.exported' then
      v_scope := 'platform';
      v_allowed := public.has_role('owner');
    else
      raise exception 'The activity log doesn''t take that action.' using errcode = '22023';
  end case;

  if not v_allowed then
    raise exception 'You can''t log that.' using errcode = '42501';
  end if;

  insert into public.activity_log (actor_id, scope, action, entity_type, entity_id, entity_name)
  values (auth.uid(), v_scope, p_action, split_part(p_action, '.', 1), left(p_entity_id, 100), left(p_entity_name, 200));
end;
$$;

revoke execute on function public.log_event(text, text, text) from public, anon;
grant execute on function public.log_event(text, text, text) to authenticated;

-- Site and platform activity plus the finance history, newest first by
-- created_at. Security invoker, so each source's own rules decide what a
-- person sees: finance rows follow the request they belong to.
create view public.activity_feed
with (security_invoker = true)
as
select
  a.id,
  a.created_at,
  a.scope,
  a.actor_id,
  a.action,
  a.entity_type,
  a.entity_id,
  a.entity_name,
  a.changes,
  null::text as note,
  null::public.request_status as from_status,
  null::public.request_status as to_status
from public.activity_log a
union all
select
  e.id,
  e.created_at,
  'finances',
  e.actor_id,
  'request.' || e.action,
  'request',
  e.request_id::text,
  null,
  e.changes,
  e.note,
  e.from_status,
  e.to_status
from public.request_events e;

revoke all on table public.activity_feed from anon, authenticated, service_role;
grant select on table public.activity_feed to authenticated;
