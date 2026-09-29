-- Error messages now say "request", like the app does, instead of
-- "reimbursement", and a few read more plainly. The app shows these messages
-- as they are. Only the message text changes. Every function keeps its body,
-- security, and grants.

-- Blocks future dates, keeps the payee and no-receipt columns admin-only, and
-- enforces the self-approval rule no matter which path writes the row.
create or replace function public.guard_reimbursement_request()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
  v_allow_external boolean;
begin
  if (tg_op = 'INSERT' or new.purchase_date is distinct from old.purchase_date)
     and new.purchase_date > v_today then
    raise exception 'The purchase date can''t be in the future.' using errcode = '22023';
  end if;

  if new.paid_at is not null
     and (tg_op = 'INSERT' or new.paid_at is distinct from old.paid_at)
     and (new.paid_at at time zone 'America/Los_Angeles')::date > v_today then
    raise exception 'The paid date can''t be in the future.' using errcode = '22023';
  end if;

  -- Direct writes from signed-in users (not the RPCs, which run as the owner).
  if current_user = 'authenticated' and public.current_app_role() is distinct from 'admin' then
    if tg_op = 'INSERT' and new.no_receipt then
      raise exception 'Only an admin can mark a request as having no receipt.' using errcode = '42501';
    end if;

    if tg_op = 'UPDATE' and (
      new.payee_id is distinct from old.payee_id
      or new.no_receipt is distinct from old.no_receipt
      or new.no_receipt_reason is distinct from old.no_receipt_reason
    ) then
      raise exception 'Only an admin can change the payee or the no-receipt setting.' using errcode = '42501';
    end if;
  end if;

  -- Self-approval: when an approval is recorded for a payee linked to the
  -- approver, an outside approver's name is required, or it's blocked outright
  -- when external approval is turned off.
  if new.approved_at is not null
     and new.approved_by is not null
     and (tg_op = 'INSERT' or old.approved_at is null)
     and exists (
       select 1
       from public.payees p
       where p.id = new.payee_id
         and p.user_id = new.approved_by
     ) then
    select s.allow_external_approval into v_allow_external
    from public.app_settings s
    where s.id = 1;

    if not coalesce(v_allow_external, false) then
      raise exception 'You can''t approve a request that''s paid to you. Another admin has to approve it.'
        using errcode = '42501';
    end if;

    if nullif(trim(new.external_approver), '') is null then
      raise exception 'This request is paid to you, so enter who approved it.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- Loads a request and locks it for the rest of the transaction.
create or replace function public.lock_request(p_request_id uuid)
returns public.reimbursement_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reimbursement_requests;
begin
  select * into v_request
  from public.reimbursement_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'That request doesn''t exist.' using errcode = 'P0002';
  end if;

  return v_request;
end;
$$;

-- A request needs at least one receipt, or the no-receipt exception.
create or replace function public.assert_receipt_rule(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
       select 1
       from public.reimbursement_requests r
       where r.id = p_request_id
         and r.no_receipt
     )
     and not exists (
       select 1
       from public.receipts rc
       where rc.request_id = p_request_id
     ) then
    raise exception 'Add a receipt first, or turn on “No receipt on file” for this request.'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.approve_request(p_request_id uuid, p_external_approver text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reimbursement_requests;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can approve requests.' using errcode = '42501';
  end if;

  v_request := public.lock_request(p_request_id);

  if v_request.status not in ('draft', 'submitted') then
    raise exception 'Only a draft or submitted request can be approved.' using errcode = '55000';
  end if;

  perform public.assert_receipt_rule(p_request_id);

  update public.reimbursement_requests
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      external_approver = nullif(trim(p_external_approver), '')
  where id = p_request_id;
end;
$$;

create or replace function public.record_as_paid(
  p_request_id uuid,
  p_method public.payment_method,
  p_reference text,
  p_paid_at timestamptz,
  p_external_approver text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reimbursement_requests;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can record payments.' using errcode = '42501';
  end if;

  v_request := public.lock_request(p_request_id);

  if v_request.status <> 'draft' then
    raise exception 'Only a draft can be recorded as paid. Use Mark paid for an approved request.'
      using errcode = '55000';
  end if;

  if p_method is null then
    raise exception 'Choose how it was paid.' using errcode = '22023';
  end if;

  if p_paid_at is null then
    raise exception 'Enter the date it was paid.' using errcode = '22023';
  end if;

  perform public.assert_receipt_rule(p_request_id);

  update public.reimbursement_requests
  set status = 'paid',
      approved_by = auth.uid(),
      approved_at = least(p_paid_at, now()), -- never after the payment, or in the future
      external_approver = nullif(trim(p_external_approver), ''),
      paid_by = auth.uid(),
      paid_at = p_paid_at,
      payment_method = p_method,
      payment_reference = nullif(trim(p_reference), '')
  where id = p_request_id;
end;
$$;

create or replace function public.mark_paid(
  p_request_id uuid,
  p_method public.payment_method,
  p_reference text default null,
  p_paid_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reimbursement_requests;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can mark requests paid.' using errcode = '42501';
  end if;

  v_request := public.lock_request(p_request_id);

  if v_request.status <> 'approved' then
    raise exception 'Only an approved request can be marked paid.' using errcode = '55000';
  end if;

  if p_method is null then
    raise exception 'Choose how it was paid.' using errcode = '22023';
  end if;

  update public.reimbursement_requests
  set status = 'paid',
      paid_by = auth.uid(),
      paid_at = coalesce(p_paid_at, now()),
      payment_method = p_method,
      payment_reference = nullif(trim(p_reference), '')
  where id = p_request_id;
end;
$$;

create or replace function public.unmark_paid(p_request_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reimbursement_requests;
  v_note text;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can undo a payment.' using errcode = '42501';
  end if;

  v_note := public.require_note(p_note);
  v_request := public.lock_request(p_request_id);

  if v_request.status <> 'paid' then
    raise exception 'Only a paid request can have its payment undone.' using errcode = '55000';
  end if;

  update public.reimbursement_requests
  set status = 'approved',
      paid_by = null,
      paid_at = null,
      payment_method = null,
      payment_reference = null,
      admin_note = v_note
  where id = p_request_id;
end;
$$;

create or replace function public.unapprove_request(p_request_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reimbursement_requests;
  v_note text;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can unapprove requests.' using errcode = '42501';
  end if;

  v_note := public.require_note(p_note);
  v_request := public.lock_request(p_request_id);

  if v_request.status <> 'approved' then
    raise exception 'Only an approved request can be unapproved.' using errcode = '55000';
  end if;

  update public.reimbursement_requests
  set status = 'submitted',
      submitted_at = coalesce(submitted_at, now()), -- unset if it was approved straight from draft
      approved_by = null,
      approved_at = null,
      external_approver = null,
      admin_note = v_note
  where id = p_request_id;
end;
$$;

create or replace function public.submit_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_app_role();
  v_request public.reimbursement_requests;
begin
  if v_role is null or v_role = 'viewer' then
    raise exception 'You don''t have permission to submit requests.' using errcode = '42501';
  end if;

  v_request := public.lock_request(p_request_id);

  -- Members can only see their own requests, so don't confirm anyone else's exists.
  if v_role <> 'admin' and v_request.payee_id is distinct from public.current_payee_id() then
    raise exception 'That request doesn''t exist.' using errcode = 'P0002';
  end if;

  if v_request.status not in ('draft', 'needs_info') then
    raise exception 'Only a draft or a request that needs info can be submitted.' using errcode = '55000';
  end if;

  perform public.assert_receipt_rule(p_request_id);

  update public.reimbursement_requests
  set status = 'submitted',
      submitted_at = now()
  where id = p_request_id;
end;
$$;

create or replace function public.request_info(p_request_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reimbursement_requests;
  v_note text;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can ask for more info.' using errcode = '42501';
  end if;

  v_note := public.require_note(p_note);
  v_request := public.lock_request(p_request_id);

  if v_request.status <> 'submitted' then
    raise exception 'You can only ask for more info on a submitted request.' using errcode = '55000';
  end if;

  update public.reimbursement_requests
  set status = 'needs_info',
      admin_note = v_note
  where id = p_request_id;
end;
$$;

create or replace function public.reject_request(p_request_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reimbursement_requests;
  v_note text;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can reject requests.' using errcode = '42501';
  end if;

  v_note := public.require_note(p_note);
  v_request := public.lock_request(p_request_id);

  if v_request.status not in ('submitted', 'needs_info') then
    raise exception 'Only a submitted request or one that needs info can be rejected.' using errcode = '55000';
  end if;

  update public.reimbursement_requests
  set status = 'rejected',
      admin_note = v_note
  where id = p_request_id;
end;
$$;

-- The payee's linked user or the admin who entered the request can cancel it.
create or replace function public.cancel_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_app_role();
  v_request public.reimbursement_requests;
begin
  if v_role is null or v_role = 'viewer' then
    raise exception 'You don''t have permission to cancel requests.' using errcode = '42501';
  end if;

  v_request := public.lock_request(p_request_id);

  if v_role <> 'admin' and v_request.payee_id is distinct from public.current_payee_id() then
    raise exception 'That request doesn''t exist.' using errcode = 'P0002';
  end if;

  if v_request.payee_id is distinct from public.current_payee_id()
     and v_request.created_by is distinct from auth.uid() then
    raise exception 'Only the admin who entered this request can cancel it. Reject it instead.'
      using errcode = '42501';
  end if;

  if v_request.status not in ('submitted', 'needs_info') then
    raise exception 'Only a submitted request or one that needs info can be cancelled.' using errcode = '55000';
  end if;

  update public.reimbursement_requests
  set status = 'cancelled'
  where id = p_request_id;
end;
$$;

-- Lines change only while the request is open, and never move to another one.
create or replace function public.guard_request_line()
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
    raise exception 'Receipts can''t change once a request is approved or closed.' using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Creates a draft, or edits a request that's still open (draft, submitted, or
-- needs info), with its lines. `p_lines` is the lines in order, each
-- {id, amount_cents, vendor}. The app picks the ids, so it can add files to a
-- line once it's saved, and saving again updates the same lines. Lines left
-- out are removed, which fails while they still have files.
create or replace function public.save_request(
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
    raise exception 'Only an admin can save requests.' using errcode = '42501';
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
      raise exception 'This request can''t be edited anymore.' using errcode = '55000';
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
    raise exception 'That receipt is on another request.' using errcode = '22023';
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
    raise exception 'Only an admin can import requests.' using errcode = '42501';
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
