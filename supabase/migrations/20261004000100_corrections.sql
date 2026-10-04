-- Corrections. An owner with two-step sign-in can fix a request that's
-- already approved or paid: its details, its receipts and their files, and
-- on a paid request how and when it was paid. Nothing is undone. The status,
-- who approved it, and who paid it all stay, and no email goes out, since the
-- status never changes. Who it's paid to can't change this way, because the
-- approval and payment were for that person. Undo the payment and approval
-- for that.
--
-- correct_request() takes a reason and logs one Corrected entry with every
-- change, even when only the receipts changed, so the history says why. It
-- reuses save_request()'s checks by opening the request with a
-- transaction-local setting (app.correcting) for the length of its own call.

alter table public.request_events
  drop constraint request_events_action_check,
  add constraint request_events_action_check check (action in (
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
    'receipt_removed',
    'corrected'
  ));

-- Lines change only while the request is open, or while correct_request()
-- has an approved or paid one open, and never move to another request.
create or replace function public.guard_request_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid := case when tg_op = 'DELETE' then old.request_id else new.request_id end;
  v_status public.request_status;
begin
  if tg_op = 'UPDATE' and new.request_id is distinct from old.request_id then
    raise exception 'A receipt can''t move to another request.' using errcode = '22023';
  end if;

  select r.status into v_status
  from public.reimbursement_requests r
  where r.id = v_request_id;

  if v_status not in ('draft', 'submitted', 'needs_info')
     and not (
       v_status in ('approved', 'paid')
       and current_setting('app.correcting', true) is not distinct from v_request_id::text
     ) then
    raise exception 'Receipts can''t change once a request is approved or closed.' using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- The same as before, except that edits during a correction aren't logged
-- one by one.
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

  -- correct_request() logs one entry for everything it changes.
  if new.status is not distinct from old.status
     and current_setting('app.correcting', true) is not distinct from new.id::text then
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

-- The same as before, except that correct_request() can save an approved or
-- paid request while it has one open.
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
      -- correct_request() opens an approved or paid request for the length of its call.
      if v_request.status not in ('draft', 'submitted', 'needs_info')
         and current_setting('app.correcting', true) is distinct from v_request.id::text then
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

-- Fixes an approved or paid request without undoing it. Takes everything
-- save_request() does except the payee, plus the payment on a paid request,
-- and the reason. The app adds and removes the receipts' files itself, under
-- the policies below.
create function public.correct_request(
  p_request_id uuid,
  p_type public.reimbursement_type,
  p_purchase_date date,
  p_description text,
  p_event_name text,
  p_no_receipt boolean,
  p_no_receipt_reason text,
  p_lines jsonb,
  p_paid_at timestamptz,
  p_payment_method public.payment_method,
  p_payment_reference text,
  p_reason text
)
returns public.reimbursement_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := trim(p_reason);
  v_before public.reimbursement_requests;
  v_after public.reimbursement_requests;
  v_lines_before jsonb;
  v_lines_after jsonb;
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb;
begin
  if not public.has_role('owner') then
    raise exception 'Only an owner can correct requests.' using errcode = '42501';
  end if;

  perform public.require_aal2();

  if nullif(v_reason, '') is null then
    raise exception 'Say what was wrong.' using errcode = '22023';
  end if;

  if char_length(v_reason) > 1000 then
    raise exception 'Keep the reason to 1,000 characters or fewer.' using errcode = '22001';
  end if;

  v_before := public.lock_request(p_request_id);

  if v_before.status not in ('approved', 'paid') then
    raise exception 'Only an approved or paid request can be corrected.' using errcode = '55000';
  end if;

  if v_before.status = 'paid' then
    if p_payment_method is null then
      raise exception 'Choose how it was paid.' using errcode = '22023';
    end if;

    if p_paid_at is null then
      raise exception 'Enter the date it was paid.' using errcode = '22023';
    end if;

    if char_length(trim(p_payment_reference)) > 200 then
      raise exception 'Keep the reference to 200 characters or fewer.' using errcode = '22001';
    end if;
  elsif p_paid_at is not null
     or p_payment_method is not null
     or nullif(trim(p_payment_reference), '') is not null then
    raise exception 'Only a paid request has a payment to correct.' using errcode = '22023';
  end if;

  v_lines_before := public.request_lines_summary(p_request_id);

  perform set_config('app.correcting', p_request_id::text, true);

  perform public.save_request(
    p_request_id,
    v_before.payee_id,
    p_type,
    p_purchase_date,
    p_description,
    p_event_name,
    p_no_receipt,
    p_no_receipt_reason,
    p_lines
  );

  if v_before.status = 'paid' then
    update public.reimbursement_requests
    set paid_at = p_paid_at,
        payment_method = p_payment_method,
        payment_reference = nullif(trim(p_payment_reference), '')
    where id = p_request_id;
  end if;

  perform set_config('app.correcting', '', true);

  select * into v_after
  from public.reimbursement_requests r
  where r.id = p_request_id;

  v_old := to_jsonb(v_before);
  v_new := to_jsonb(v_after);

  select jsonb_object_agg(f.field, jsonb_build_object('from', v_old -> f.field, 'to', v_new -> f.field))
  into v_changes
  from unnest(array[
    'type',
    'amount_cents',
    'purchase_date',
    'vendor',
    'description',
    'event_name',
    'no_receipt',
    'no_receipt_reason',
    'paid_at',
    'payment_method',
    'payment_reference'
  ]) as f(field)
  where v_old -> f.field is distinct from v_new -> f.field;

  -- Like an edit: the lines as they were and as they are, when there's more than one.
  v_lines_after := public.request_lines_summary(p_request_id);
  if v_lines_before is distinct from v_lines_after
     and greatest(jsonb_array_length(v_lines_before), jsonb_array_length(v_lines_after)) > 1 then
    v_changes := coalesce(v_changes, '{}'::jsonb)
      || jsonb_build_object('lines', jsonb_build_object('from', v_lines_before, 'to', v_lines_after));
  end if;

  insert into public.request_events (request_id, actor_id, action, from_status, to_status, note, changes)
  values (p_request_id, auth.uid(), 'corrected', v_after.status, v_after.status, v_reason, v_changes);

  return v_after;
end;
$$;

revoke execute on function public.correct_request(
  uuid, public.reimbursement_type, date, text, text, boolean, text, jsonb, timestamptz, public.payment_method, text, text
) from public, anon;
grant execute on function public.correct_request(
  uuid, public.reimbursement_type, date, text, text, boolean, text, jsonb, timestamptz, public.payment_method, text, text
) to authenticated;

-- Receipts and their files on approved and paid requests, for corrections.
-- Only owners, and only with two-step sign-in, like correct_request().
create policy "Owners add receipts to approved and paid requests"
  on public.receipts for insert
  to authenticated
  with check (
    (select public.has_role('owner'))
    and (select auth.jwt() ->> 'aal') = 'aal2'
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id = receipts.request_id
        and r.status in ('approved', 'paid')
    )
  );

create policy "Owners remove receipts from approved and paid requests"
  on public.receipts for delete
  to authenticated
  using (
    (select public.has_role('owner'))
    and (select auth.jwt() ->> 'aal') = 'aal2'
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id = receipts.request_id
        and r.status in ('approved', 'paid')
    )
  );

create policy "Owners upload receipt files to approved and paid requests"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (select public.has_role('owner'))
    and (select auth.jwt() ->> 'aal') = 'aal2'
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id::text = (storage.foldername(objects.name))[1]
        and r.status in ('approved', 'paid')
    )
  );

create policy "Owners delete receipt files from approved and paid requests"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and (select public.has_role('owner'))
    and (select auth.jwt() ->> 'aal') = 'aal2'
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id::text = (storage.foldername(objects.name))[1]
        and r.status in ('approved', 'paid')
    )
  );
