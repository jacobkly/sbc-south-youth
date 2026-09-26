-- Imports already-paid reimbursements from a spreadsheet, all or nothing.
--
-- Each row becomes a draft that's recorded as paid through record_as_paid, so
-- the same rules and audit log apply as when it's entered by hand. Payees are
-- matched by name, ignoring case and extra spaces, and added when missing.
-- Spreadsheets have no vendor or receipts, so every row gets the vendor
-- "Not recorded" and the no-receipt exception with a reason.

create function public.import_paid_requests(
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
  v_request_id uuid;
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

      insert into public.reimbursement_requests (
        payee_id,
        created_by,
        type,
        amount_cents,
        purchase_date,
        vendor,
        description,
        no_receipt,
        no_receipt_reason
      ) values (
        v_payee.id,
        auth.uid(),
        (v_row ->> 'type')::public.reimbursement_type,
        (v_row ->> 'amount_cents')::integer,
        v_date,
        'Not recorded',
        coalesce(nullif(trim(v_row ->> 'notes'), ''), 'Not recorded'),
        true,
        'Imported from spreadsheet'
      )
      returning id into v_request_id;

      -- Paid at noon in Los Angeles, like any payment entered with only a date.
      -- The outside approver only applies to rows paid to the admin importing.
      perform public.record_as_paid(
        v_request_id,
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

revoke execute on function public.import_paid_requests(jsonb, public.payment_method, text) from public, anon;
grant execute on function public.import_paid_requests(jsonb, public.payment_method, text) to authenticated;
