-- Status RPCs for approving and paying, with their undo actions, plus the
-- helpers every status RPC shares. When one records an approval, the guard
-- trigger on reimbursement_requests enforces the self-approval rule.

-- Loads a request and locks it for the rest of the transaction.
create function public.lock_request(p_request_id uuid)
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
    raise exception 'That reimbursement doesn''t exist.' using errcode = 'P0002';
  end if;

  return v_request;
end;
$$;

revoke execute on function public.lock_request(uuid) from public, anon, authenticated;

-- A request needs at least one receipt, or the no-receipt exception with a reason.
create function public.assert_receipt_rule(p_request_id uuid)
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
    raise exception 'Add at least one receipt, or mark it as having no receipt and give a reason.'
      using errcode = '23514';
  end if;
end;
$$;

revoke execute on function public.assert_receipt_rule(uuid) from public, anon, authenticated;

-- Returns the trimmed note, or raises when it's missing or too long.
create function public.require_note(p_note text)
returns text
language plpgsql
set search_path = ''
as $$
begin
  if nullif(trim(p_note), '') is null then
    raise exception 'Add a note explaining why.' using errcode = '22023';
  end if;

  if char_length(trim(p_note)) > 1000 then
    raise exception 'Keep the note under 1,000 characters.' using errcode = '22001';
  end if;

  return trim(p_note);
end;
$$;

revoke execute on function public.require_note(text) from public, anon, authenticated;

create function public.approve_request(p_request_id uuid, p_external_approver text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reimbursement_requests;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can approve reimbursements.' using errcode = '42501';
  end if;

  v_request := public.lock_request(p_request_id);

  if v_request.status not in ('draft', 'submitted') then
    raise exception 'Only a draft or submitted reimbursement can be approved.' using errcode = '55000';
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

revoke execute on function public.approve_request(uuid, text) from public, anon;
grant execute on function public.approve_request(uuid, text) to authenticated;

-- Draft straight to paid, for a reimbursement that was paid before it was
-- entered. The admin recording it is also recorded as the approver.

create function public.record_as_paid(
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
    raise exception 'Only a draft can be recorded as paid. Use Mark paid for approved reimbursements.'
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

revoke execute on function public.record_as_paid(uuid, public.payment_method, text, timestamptz, text) from public, anon;
grant execute on function public.record_as_paid(uuid, public.payment_method, text, timestamptz, text) to authenticated;

create function public.mark_paid(
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
    raise exception 'Only an admin can mark reimbursements as paid.' using errcode = '42501';
  end if;

  v_request := public.lock_request(p_request_id);

  if v_request.status <> 'approved' then
    raise exception 'Only an approved reimbursement can be marked as paid.' using errcode = '55000';
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

revoke execute on function public.mark_paid(uuid, public.payment_method, text, timestamptz) from public, anon;
grant execute on function public.mark_paid(uuid, public.payment_method, text, timestamptz) to authenticated;

-- Undoes a payment: paid back to approved.

create function public.unmark_paid(p_request_id uuid, p_note text)
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
    raise exception 'Only a paid reimbursement can be unmarked as paid.' using errcode = '55000';
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

revoke execute on function public.unmark_paid(uuid, text) from public, anon;
grant execute on function public.unmark_paid(uuid, text) to authenticated;

-- Undoes an approval: approved back to submitted, for another review.

create function public.unapprove_request(p_request_id uuid, p_note text)
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
    raise exception 'Only an admin can unapprove reimbursements.' using errcode = '42501';
  end if;

  v_note := public.require_note(p_note);
  v_request := public.lock_request(p_request_id);

  if v_request.status <> 'approved' then
    raise exception 'Only an approved reimbursement can be unapproved.' using errcode = '55000';
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

revoke execute on function public.unapprove_request(uuid, text) from public, anon;
grant execute on function public.unapprove_request(uuid, text) to authenticated;
