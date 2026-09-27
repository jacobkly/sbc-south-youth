-- Amounts per receipt. A request is made of lines (called receipts in the
-- app), each with an amount, an optional vendor, and its own files. The
-- request's amount is the sum of its lines, and its vendor the list of their
-- vendors, so reports and the queue keep reading one row per request.
--
-- Requests are now created and edited through save_request, which writes the
-- request and its lines together.

create table public.request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.reimbursement_requests (id) on delete cascade,
  -- Up to 10 per request, the same as its files.
  position smallint not null check (position between 1 and 10),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  vendor text check (char_length(trim(vendor)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Deferred, so an edit can reorder lines.
  constraint request_lines_position_key unique (request_id, position) deferrable initially deferred,
  -- Lets a receipt point at a line on its own request.
  constraint request_lines_request_line_key unique (request_id, id)
);

create trigger set_updated_at
  before update on public.request_lines
  for each row execute function public.set_updated_at();

-- Every request becomes one line with its amount and vendor.
insert into public.request_lines (request_id, position, amount_cents, vendor, created_at, updated_at)
select r.id, 1, r.amount_cents, r.vendor, r.created_at, r.updated_at
from public.reimbursement_requests r;

-- Every file goes on its request's line.
alter table public.receipts add column line_id uuid;

update public.receipts rc
set line_id = l.id
from public.request_lines l
where l.request_id = rc.request_id;

-- A line with files can't be deleted, so files are never left without one.
alter table public.receipts
  alter column line_id set not null,
  add constraint receipts_line_fkey
    foreign key (request_id, line_id) references public.request_lines (request_id, id);

create index receipts_line_id_idx on public.receipts (line_id);

-- The request's vendor is now a list, so it fits ten 100-character vendors
-- and the commas between them.
alter table public.reimbursement_requests
  drop constraint reimbursement_requests_vendor_check,
  add constraint reimbursement_requests_vendor_check check (char_length(trim(vendor)) between 1 and 1018);

-- Vendors in order with no repeats, e.g. "Costco, Target". Case and spaces
-- don't make a vendor different, and the first spelling is kept. Null when
-- there are none.
create function public.vendor_list(p_vendors text[])
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(v.vendor, ', ' order by v.first_at)
  from (
    select distinct on (lower(trim(u.vendor))) trim(u.vendor) as vendor, u.ord as first_at
    from unnest(p_vendors) with ordinality as u (vendor, ord)
    where nullif(trim(u.vendor), '') is not null
    order by lower(trim(u.vendor)), u.ord
  ) as v;
$$;

revoke execute on function public.vendor_list(text[]) from public, anon, authenticated;

create function public.request_vendor_list(p_request_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.vendor_list(array_agg(l.vendor order by l.position))
  from public.request_lines l
  where l.request_id = p_request_id;
$$;

revoke execute on function public.request_vendor_list(uuid) from public, anon, authenticated;

-- A request's lines as the audit log records them, in order.
create function public.request_lines_summary(p_request_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('amount_cents', l.amount_cents, 'vendor', l.vendor) order by l.position),
    '[]'::jsonb
  )
  from public.request_lines l
  where l.request_id = p_request_id;
$$;

revoke execute on function public.request_lines_summary(uuid) from public, anon, authenticated;

-- A backfilled vendor with stray spaces would never match its trimmed list.
update public.reimbursement_requests r
set vendor = public.request_vendor_list(r.id)
where r.vendor is distinct from public.request_vendor_list(r.id);

-- At commit, a request's total and vendors have to match its lines, and it
-- needs at least one.
create function public.check_request_lines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_request public.reimbursement_requests;
  v_count integer;
  v_total bigint;
begin
  if tg_table_name = 'request_lines' then
    v_request_id := case when tg_op = 'DELETE' then old.request_id else new.request_id end;
  else
    v_request_id := new.id;
  end if;

  select * into v_request
  from public.reimbursement_requests r
  where r.id = v_request_id;

  -- Deleting a request takes its lines with it.
  if not found then
    return null;
  end if;

  select count(*), sum(l.amount_cents) into v_count, v_total
  from public.request_lines l
  where l.request_id = v_request_id;

  if v_count = 0 then
    raise exception 'A request needs at least one receipt amount.' using errcode = '23514';
  end if;

  if v_total is distinct from v_request.amount_cents
     or public.request_vendor_list(v_request_id) is distinct from v_request.vendor then
    raise exception 'A request''s total and vendors have to match its receipts.' using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke execute on function public.check_request_lines() from public, anon, authenticated;

create constraint trigger request_lines_match
  after insert or update of amount_cents, vendor on public.reimbursement_requests
  deferrable initially deferred
  for each row execute function public.check_request_lines();

create constraint trigger request_lines_match
  after insert or update or delete on public.request_lines
  deferrable initially deferred
  for each row execute function public.check_request_lines();

-- Lines change only while the request is open, and never move to another one.
create function public.guard_request_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.request_status;
begin
  if tg_op = 'UPDATE' and new.request_id is distinct from old.request_id then
    raise exception 'A receipt can''t move to another request.' using errcode = '22023';
  end if;

  select r.status into v_status
  from public.reimbursement_requests r
  where r.id = case when tg_op = 'DELETE' then old.request_id else new.request_id end;

  if v_status not in ('draft', 'submitted', 'needs_info') then
    raise exception 'Receipts can''t change once a reimbursement is approved or closed.' using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function public.guard_request_line() from public, anon, authenticated;

create trigger guard_request_line
  before insert or update or delete on public.request_lines
  for each row execute function public.guard_request_line();

-- Readable with the request. Only save_request writes them.
alter table public.request_lines enable row level security;

revoke all on table public.request_lines from anon, authenticated;
grant select on table public.request_lines to authenticated;

create policy "Lines are readable with their request"
  on public.request_lines for select
  to authenticated
  using (
    exists (
      select 1
      from public.reimbursement_requests r
      where r.id = request_lines.request_id
    )
  );

-- The total and vendors follow the lines, so clients can't write them, and
-- new requests come from save_request.
revoke insert on table public.reimbursement_requests from authenticated;
revoke update (amount_cents, vendor) on table public.reimbursement_requests from authenticated;
drop policy "Admins create draft requests" on public.reimbursement_requests;

-- A file is added to a line.
grant insert (line_id) on table public.receipts to authenticated;

-- Edits log the lines as they were and as they are, when the request has
-- more than one. With one, the amount and vendor already say it all.
create or replace function public.log_request_event()
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
  v_lines_before jsonb;
  v_lines_after jsonb;
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

  -- save_request notes the lines as they were before it changed them.
  v_lines_before := nullif(current_setting('app.lines_before', true), '')::jsonb;
  if v_lines_before ->> 'request_id' = new.id::text then
    v_lines_after := public.request_lines_summary(new.id);
    if v_lines_before -> 'lines' is distinct from v_lines_after
       and greatest(jsonb_array_length(v_lines_before -> 'lines'), jsonb_array_length(v_lines_after)) > 1 then
      v_changes := coalesce(v_changes, '{}'::jsonb)
        || jsonb_build_object('lines', jsonb_build_object('from', v_lines_before -> 'lines', 'to', v_lines_after));
    end if;
  end if;

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

-- Creates a draft, or edits a request that's still open (draft, submitted, or
-- needs info), with its lines. `p_lines` is the lines in order, each
-- {id, amount_cents, vendor}. The app picks the ids, so it can add files to a
-- line once it's saved, and saving again updates the same lines. Lines left
-- out are removed, which fails while they still have files.
create function public.save_request(
  p_request_id uuid,
  p_payee_id uuid,
  p_type public.reimbursement_type,
  p_purchase_date date,
  p_description text,
  p_event_name text,
  p_no_receipt boolean,
  p_no_receipt_reason text,
  p_lines jsonb
)
returns public.reimbursement_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reimbursement_requests;
  v_ids uuid[];
  v_amounts integer[];
  v_vendors text[];
  v_total bigint;
  v_no_receipt boolean := coalesce(p_no_receipt, false);
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can save reimbursements.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Enter an amount.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_lines) > 10 then
    raise exception 'A request can have at most 10 receipts.' using errcode = '22023';
  end if;

  select
    array_agg((e.value ->> 'id')::uuid order by e.ord),
    array_agg((e.value ->> 'amount_cents')::integer order by e.ord),
    array_agg(nullif(trim(e.value ->> 'vendor'), '') order by e.ord)
  into v_ids, v_amounts, v_vendors
  from jsonb_array_elements(p_lines) with ordinality as e (value, ord);

  if array_position(v_ids, null) is not null
     or (select count(distinct i) from unnest(v_ids) as i) <> cardinality(v_ids) then
    raise exception 'Each receipt needs its own id.' using errcode = '22023';
  end if;

  if exists (select 1 from unnest(v_amounts) as a where a is null or a <= 0) then
    raise exception 'Each receipt needs an amount more than $0.' using errcode = '23514';
  end if;

  if exists (select 1 from unnest(v_amounts) as a where a > 100000000) then
    raise exception 'A receipt can''t be more than $1,000,000.' using errcode = '23514';
  end if;

  select sum(a) into v_total from unnest(v_amounts) as a;
  if v_total > 100000000 then
    raise exception 'The total can''t be more than $1,000,000.' using errcode = '23514';
  end if;

  if exists (select 1 from unnest(v_vendors) as v where char_length(v) > 100) then
    raise exception 'A vendor can be at most 100 characters.' using errcode = '23514';
  end if;

  if p_request_id is null then
    insert into public.reimbursement_requests (
      payee_id,
      created_by,
      type,
      amount_cents,
      purchase_date,
      vendor,
      description,
      event_name,
      no_receipt,
      no_receipt_reason
    ) values (
      p_payee_id,
      auth.uid(),
      p_type,
      v_total,
      p_purchase_date,
      public.vendor_list(v_vendors),
      nullif(trim(p_description), ''),
      nullif(trim(p_event_name), ''),
      v_no_receipt,
      case when v_no_receipt then nullif(trim(p_no_receipt_reason), '') end
    )
    returning * into v_request;
  else
    v_request := public.lock_request(p_request_id);

    if v_request.status not in ('draft', 'submitted', 'needs_info') then
      raise exception 'This reimbursement can''t be edited anymore.' using errcode = '55000';
    end if;

    perform set_config(
      'app.lines_before',
      jsonb_build_object('request_id', v_request.id, 'lines', public.request_lines_summary(v_request.id))::text,
      true
    );
  end if;

  if exists (
    select 1
    from public.request_lines l
    where l.id = any (v_ids)
      and l.request_id <> v_request.id
  ) then
    raise exception 'That receipt is on another reimbursement.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.receipts rc
    where rc.request_id = v_request.id
      and rc.line_id <> all (v_ids)
  ) then
    raise exception 'Remove a receipt''s files before removing the receipt.' using errcode = '55000';
  end if;

  delete from public.request_lines l
  where l.request_id = v_request.id
    and l.id <> all (v_ids);

  update public.request_lines l
  set position = u.ord,
      amount_cents = u.amount_cents,
      vendor = u.vendor
  from unnest(v_ids, v_amounts, v_vendors) with ordinality as u (id, amount_cents, vendor, ord)
  where l.id = u.id
    and l.request_id = v_request.id
    and (l.position, l.amount_cents, l.vendor) is distinct from (u.ord::smallint, u.amount_cents, u.vendor);

  insert into public.request_lines (id, request_id, position, amount_cents, vendor)
  select u.id, v_request.id, u.ord, u.amount_cents, u.vendor
  from unnest(v_ids, v_amounts, v_vendors) with ordinality as u (id, amount_cents, vendor, ord)
  where not exists (select 1 from public.request_lines l where l.id = u.id);

  if p_request_id is not null then
    update public.reimbursement_requests
    set payee_id = p_payee_id,
        type = p_type,
        amount_cents = v_total,
        purchase_date = p_purchase_date,
        vendor = public.vendor_list(v_vendors),
        description = nullif(trim(p_description), ''),
        event_name = nullif(trim(p_event_name), ''),
        no_receipt = v_no_receipt,
        no_receipt_reason = case when v_no_receipt then nullif(trim(p_no_receipt_reason), '') end
    where id = v_request.id
    returning * into v_request;

    perform set_config('app.lines_before', '', true);
  end if;

  return v_request;
end;
$$;

revoke execute on function public.save_request(
  uuid, uuid, public.reimbursement_type, date, text, text, boolean, text, jsonb
) from public, anon;
grant execute on function public.save_request(
  uuid, uuid, public.reimbursement_type, date, text, text, boolean, text, jsonb
) to authenticated;

-- Imported rows are one line each.
create or replace function public.import_paid_requests(
  p_rows jsonb,
  p_method public.payment_method,
  p_external_approver text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_line integer;
  v_name text;
  v_date date;
  v_payee public.payees;
  v_request public.reimbursement_requests;
  v_requests integer := 0;
  v_payees integer := 0;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can import reimbursements.' using errcode = '42501';
  end if;

  if p_method is null then
    raise exception 'Choose how they were paid.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'There are no rows to import.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Import at most 2,000 rows at a time.' using errcode = '22023';
  end if;

  for v_row in select r.value from jsonb_array_elements(p_rows) as r loop
    v_line := v_row ->> 'line';

    begin
      v_name := regexp_replace(trim(v_row ->> 'name'), '\s+', ' ', 'g');
      v_date := v_row ->> 'date';

      select * into v_payee
      from public.payees p
      where lower(regexp_replace(trim(p.full_name), '\s+', ' ', 'g')) = lower(v_name)
      order by p.is_active desc, p.created_at
      limit 1;

      if not found then
        insert into public.payees (full_name)
        values (v_name)
        returning * into v_payee;

        v_payees := v_payees + 1;
      end if;

      v_request := public.save_request(
        null,
        v_payee.id,
        (v_row ->> 'type')::public.reimbursement_type,
        v_date,
        v_row ->> 'notes',
        null,
        true,
        'Imported from spreadsheet',
        jsonb_build_array(
          jsonb_build_object('id', gen_random_uuid(), 'amount_cents', (v_row ->> 'amount_cents')::integer)
        )
      );

      -- Paid at noon in Los Angeles, like any payment entered with only a date.
      -- The outside approver only applies to rows paid to the admin importing.
      perform public.record_as_paid(
        v_request.id,
        p_method,
        null,
        (v_date + time '12:00') at time zone 'America/Los_Angeles',
        case when v_payee.user_id = auth.uid() then p_external_approver end
      );

      v_requests := v_requests + 1;
    exception
      when others then
        -- The app's own messages are sentences worth showing. Anything else
        -- (a bad cast or a failed check) gets a plain message.
        if sqlerrm ~ '^[A-Z].*\.$' then
          raise exception 'Row %: %', coalesce(v_line::text, '?'), sqlerrm using errcode = sqlstate;
        end if;

        raise exception 'Row % couldn''t be imported. Check its date, name, amount, and type.',
          coalesce(v_line::text, '?')
          using errcode = '22023';
    end;
  end loop;

  return jsonb_build_object('requests', v_requests, 'payees', v_payees);
end;
$$;
