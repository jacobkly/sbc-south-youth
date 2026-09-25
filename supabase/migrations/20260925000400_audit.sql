-- Append-only audit log for requests, written only by triggers.

create table public.request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.reimbursement_requests (id) on delete cascade,
  actor_id uuid references public.users (id),
  action text not null check (action in (
    'created',
    'updated',
    'submitted',
    'approved',
    'recorded_paid',
    'info_requested',
    'rejected',
    'cancelled',
    'unapproved',
    'paid',
    'unpaid',
    'receipt_added',
    'receipt_removed'
  )),
  from_status public.request_status,
  to_status public.request_status,
  note text,
  changes jsonb,
  created_at timestamptz not null default now()
);

create index request_events_request_id_idx on public.request_events (request_id, created_at);
create index request_events_actor_id_idx on public.request_events (actor_id);

alter table public.request_events enable row level security;

-- No client writes at all, and no updates or deletes for any role but the owner.
revoke all on table public.request_events from anon, authenticated;
revoke insert, update, delete, truncate on table public.request_events from service_role;
grant select on table public.request_events to authenticated;

create policy "Events are readable with their request"
  on public.request_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.reimbursement_requests r
      where r.id = request_events.request_id
    )
  );

-- Logs each insert and update on a request. A status change is logged as its
-- action, with the note the status RPCs leave in admin_note. Edits to the
-- purchase details are logged with old and new values, and an edit that
-- changes none of them isn't logged. Security definer, since clients can't
-- write to request_events.
create function public.log_request_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_note text;
  v_changes jsonb;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.request_events (request_id, actor_id, action, to_status)
    values (new.id, auth.uid(), 'created', new.status);
    return null;
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);

  select jsonb_object_agg(f.field, jsonb_build_object('from', v_old -> f.field, 'to', v_new -> f.field))
  into v_changes
  from unnest(array[
    'payee_id',
    'type',
    'amount_cents',
    'purchase_date',
    'vendor',
    'description',
    'event_name',
    'no_receipt',
    'no_receipt_reason'
  ]) as f(field)
  where v_old -> f.field is distinct from v_new -> f.field;

  if new.status is distinct from old.status then
    v_action := case
      when new.status = 'submitted' and old.status = 'approved' then 'unapproved'
      when new.status = 'submitted' then 'submitted'
      when new.status = 'approved' and old.status = 'paid' then 'unpaid'
      when new.status = 'approved' then 'approved'
      when new.status = 'paid' and old.status = 'approved' then 'paid'
      when new.status = 'paid' then 'recorded_paid'
      when new.status = 'needs_info' then 'info_requested'
      when new.status = 'rejected' then 'rejected'
      when new.status = 'cancelled' then 'cancelled'
    end;

    if v_action in ('unapproved', 'unpaid', 'info_requested', 'rejected') then
      v_note := new.admin_note;
    end if;

    insert into public.request_events (request_id, actor_id, action, from_status, to_status, note, changes)
    values (new.id, auth.uid(), coalesce(v_action, 'updated'), old.status, new.status, v_note, v_changes);
  elsif v_changes is not null then
    insert into public.request_events (request_id, actor_id, action, from_status, to_status, changes)
    values (new.id, auth.uid(), 'updated', old.status, new.status, v_changes);
  end if;

  return null;
end;
$$;

revoke execute on function public.log_request_event() from public, anon, authenticated;

create trigger log_request_event
  after insert or update on public.reimbursement_requests
  for each row execute function public.log_request_event();
