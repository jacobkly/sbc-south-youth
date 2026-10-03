-- Two-step sign-in in the database. Changing who has access, and approving
-- or paying requests (or undoing either), now need a session that has
-- entered a code from an authenticator app, which Supabase calls aal2. Both
-- apps already send owners to the code step first; this stops someone with
-- only the password from calling these functions directly. Reading isn't
-- affected.
--
-- Each function checks the role first, so someone without it still hears
-- about the role. The older finance functions that change a role or turn
-- someone off are covered too, since they'd otherwise go around set_roles()
-- and remove_access(). The bodies are unchanged apart from the one call.

-- Raises unless this session has entered an authenticator code.
create function public.require_aal2()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if (auth.jwt() ->> 'aal') is distinct from 'aal2' then
    raise exception 'This needs two-step sign-in. Enter a code from your authenticator app, then try again.'
      using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.require_aal2() from public, anon, authenticated;

-- Access.

create or replace function public.set_roles(p_user_id uuid, p_roles public.app_role[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'Only an owner can change roles.' using errcode = '42501';
  end if;

  perform public.require_aal2();

  if p_roles is null or array_position(p_roles, null) is not null then
    raise exception 'Choose the roles.' using errcode = '22023';
  end if;

  update public.users
  set roles = p_roles, updated_by = auth.uid()
  where id = p_user_id;

  if not found then
    raise exception 'That person doesn''t exist.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.set_member_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can change roles.' using errcode = '42501';
  end if;

  perform public.require_aal2();

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

create or replace function public.set_member_active(p_user_id uuid, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only an admin can activate or deactivate users.' using errcode = '42501';
  end if;

  perform public.require_aal2();

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

create or replace function public.remove_access(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'Only an owner can remove access.' using errcode = '42501';
  end if;

  perform public.require_aal2();

  if p_user_id = auth.uid() then
    raise exception 'You can''t remove your own access.' using errcode = '42501';
  end if;

  perform 1 from public.users u where u.id = p_user_id;
  if not found then
    raise exception 'That person doesn''t exist.' using errcode = 'P0002';
  end if;

  update public.users
  set is_active = false, updated_by = auth.uid()
  where id = p_user_id and is_active;
end;
$$;

create or replace function public.reinstate(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'Only an owner can reinstate people.' using errcode = '42501';
  end if;

  perform public.require_aal2();

  perform 1 from public.users u where u.id = p_user_id;
  if not found then
    raise exception 'That person doesn''t exist.' using errcode = 'P0002';
  end if;

  update public.users
  set is_active = true, updated_by = auth.uid()
  where id = p_user_id and not is_active;
end;
$$;

-- Approving and paying.

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

  perform public.require_aal2();

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

  perform public.require_aal2();

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

  perform public.require_aal2();

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

  perform public.require_aal2();

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

  perform public.require_aal2();

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

  perform public.require_aal2();

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
