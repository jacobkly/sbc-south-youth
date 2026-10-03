-- Requesters in finances. Someone with the finance requester role starts,
-- edits, submits, and cancels their own requests, adds and removes their
-- receipts, and reads only the requests paid to them, through the payee
-- they're linked to. They never read payees, settings, the report, or anyone
-- else's requests, and never approve or pay.
--
-- Lines, receipts, history, and receipt files already follow the request
-- they belong to, so one new read policy on requests covers them all.
--
-- submit_request() and cancel_request() check the requester role instead of
-- the older single role, so a viewer who is also a requester can submit their
-- own. Someone with no finance role keeps nothing, even with a linked payee.

-- Reading. Owners already read everything, and viewers everything past draft.
create policy "Requesters read requests paid to them"
  on public.reimbursement_requests for select
  to authenticated
  using (
    (select public.has_role('finance_requester'))
    and payee_id = (select public.current_payee_id())
  );

-- A requester deletes only a draft they started, not one an owner entered for
-- them.
create policy "Requesters delete their own drafts"
  on public.reimbursement_requests for delete
  to authenticated
  using (
    (select public.has_role('finance_requester'))
    and payee_id = (select public.current_payee_id())
    and status = 'draft'
    and created_by = (select auth.uid())
  );

-- Receipts and their files, on their own drafts and on requests sent back to
-- them for more info. Once it's submitted, only an owner changes them.
create policy "Requesters add receipts to their editable requests"
  on public.receipts for insert
  to authenticated
  with check (
    (select public.has_role('finance_requester'))
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id = receipts.request_id
        and r.payee_id = (select public.current_payee_id())
        and r.status in ('draft', 'needs_info')
    )
  );

create policy "Requesters remove receipts from their editable requests"
  on public.receipts for delete
  to authenticated
  using (
    (select public.has_role('finance_requester'))
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id = receipts.request_id
        and r.payee_id = (select public.current_payee_id())
        and r.status in ('draft', 'needs_info')
    )
  );

create policy "Requesters upload receipt files to their editable requests"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (select public.has_role('finance_requester'))
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id::text = (storage.foldername(objects.name))[1]
        and r.payee_id = (select public.current_payee_id())
        and r.status in ('draft', 'needs_info')
    )
  );

create policy "Requesters delete receipt files from their editable requests"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and (select public.has_role('finance_requester'))
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id::text = (storage.foldername(objects.name))[1]
        and r.payee_id = (select public.current_payee_id())
        and r.status in ('draft', 'needs_info')
    )
  );

-- The report is for owners and viewers. A viewer who is also a requester
-- can read their own drafts, so drafts stay out of the report for viewers.
create or replace view public.request_report
with (security_invoker = true)
as
select
  r.id,
  r.request_number,
  r.status,
  r.type,
  r.amount_cents,
  r.purchase_date,
  (r.paid_at at time zone 'America/Los_Angeles')::date as paid_date,
  r.payee_id,
  r.created_by,
  r.vendor,
  r.description,
  r.event_name,
  r.no_receipt,
  r.no_receipt_reason,
  r.submitted_at,
  r.approved_by,
  r.external_approver,
  r.approved_at,
  r.paid_by,
  r.paid_at,
  r.payment_method,
  r.payment_reference
from public.reimbursement_requests r
where (select public.has_role('owner'))
  or ((select public.has_role('finance_viewer')) and r.status <> 'draft');

-- Owners and requesters submit. A requester submits only requests paid to
-- them.
create or replace function public.submit_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner boolean := public.has_role('owner');
  v_request public.reimbursement_requests;
begin
  if not public.has_role('finance_requester') then
    raise exception 'You don''t have permission to submit requests.' using errcode = '42501';
  end if;

  v_request := public.lock_request(p_request_id);

  -- Requesters can only see their own requests, so don't confirm anyone else's exists.
  if not v_owner and v_request.payee_id is distinct from public.current_payee_id() then
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

-- The payee's linked user or the owner who entered the request can cancel it.
create or replace function public.cancel_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner boolean := public.has_role('owner');
  v_request public.reimbursement_requests;
begin
  if not public.has_role('finance_requester') then
    raise exception 'You don''t have permission to cancel requests.' using errcode = '42501';
  end if;

  v_request := public.lock_request(p_request_id);

  if not v_owner and v_request.payee_id is distinct from public.current_payee_id() then
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

-- Creates a draft, or edits one with its lines. `p_lines` is the lines in
-- order, each {id, amount_cents, vendor}. The app picks the ids, so it can add
-- files to a line once it's saved, and saving again updates the same lines.
-- Lines left out are removed, which fails while they still have files.
--
-- Owners save for any payee while a request is open (draft, submitted, or
-- needs info). Requesters save only requests paid to them, while they're a
-- draft or need info, and the no-receipt exception stays as an owner set it.
-- Saving never submits.
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
  v_owner boolean := public.has_role('owner');
  v_payee_id uuid := public.current_payee_id();
  v_no_receipt boolean := false;
  v_no_receipt_reason text;
begin
  if not public.has_role('finance_requester') then
    raise exception 'You don''t have permission to save requests.' using errcode = '42501';
  end if;

  -- Owners save for anyone and can use the no-receipt exception. Requesters
  -- save only requests paid to them, and never change the exception.
  if v_owner then
    v_no_receipt := coalesce(p_no_receipt, false);
    v_no_receipt_reason := case when v_no_receipt then nullif(trim(p_no_receipt_reason), '') end;
  elsif v_payee_id is null then
    raise exception 'Your account isn''t linked to a payee yet. Ask an owner to link it.' using errcode = '42501';
  elsif p_payee_id is distinct from v_payee_id then
    raise exception 'You can only save requests paid to you.' using errcode = '42501';
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
      v_no_receipt_reason
    )
    returning * into v_request;
  else
    v_request := public.lock_request(p_request_id);

    if v_owner then
      if v_request.status not in ('draft', 'submitted', 'needs_info') then
        raise exception 'This request can''t be edited anymore.' using errcode = '55000';
      end if;
    else
      if v_request.payee_id is distinct from v_payee_id then
        raise exception 'That request doesn''t exist.' using errcode = 'P0002';
      end if;

      if v_request.status not in ('draft', 'needs_info') then
        raise exception 'Only a draft or a request that needs info can be edited.' using errcode = '55000';
      end if;

      v_no_receipt := v_request.no_receipt;
      v_no_receipt_reason := v_request.no_receipt_reason;
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
        no_receipt_reason = v_no_receipt_reason
    where id = v_request.id
    returning * into v_request;

    perform set_config('app.lines_before', '', true);
  end if;

  return v_request;
end;
$$;
