-- Status RPCs for the review loop: submit, request info, reject, and cancel.
-- Submit and cancel also work for the payee's own linked account, so a
-- member can manage their own requests.

create function public.submit_request(p_request_id uuid)
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
    raise exception 'You don''t have permission to submit reimbursements.' using errcode = '42501';
  end if;

  v_request := public.lock_request(p_request_id);

  -- Members can only see their own requests, so don't confirm anyone else's exists.
  if v_role <> 'admin' and v_request.payee_id is distinct from public.current_payee_id() then
    raise exception 'That reimbursement doesn''t exist.' using errcode = 'P0002';
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

revoke execute on function public.submit_request(uuid) from public, anon;
grant execute on function public.submit_request(uuid) to authenticated;

create function public.request_info(p_request_id uuid, p_note text)
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
    raise exception 'You can only ask for more info on a submitted reimbursement.' using errcode = '55000';
  end if;

  update public.reimbursement_requests
  set status = 'needs_info',
      admin_note = v_note
  where id = p_request_id;
end;
$$;

revoke execute on function public.request_info(uuid, text) from public, anon;
grant execute on function public.request_info(uuid, text) to authenticated;

create function public.reject_request(p_request_id uuid, p_note text)
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
    raise exception 'Only an admin can reject reimbursements.' using errcode = '42501';
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

revoke execute on function public.reject_request(uuid, text) from public, anon;
grant execute on function public.reject_request(uuid, text) to authenticated;

-- The payee's linked user or the admin who entered the request can cancel it.
create function public.cancel_request(p_request_id uuid)
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
    raise exception 'You don''t have permission to cancel reimbursements.' using errcode = '42501';
  end if;

  v_request := public.lock_request(p_request_id);

  if v_role <> 'admin' and v_request.payee_id is distinct from public.current_payee_id() then
    raise exception 'That reimbursement doesn''t exist.' using errcode = 'P0002';
  end if;

  if v_request.payee_id is distinct from public.current_payee_id()
     and v_request.created_by is distinct from auth.uid() then
    raise exception 'Only the admin who entered this reimbursement can cancel it. Reject it instead.'
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

revoke execute on function public.cancel_request(uuid) from public, anon;
grant execute on function public.cancel_request(uuid) to authenticated;
