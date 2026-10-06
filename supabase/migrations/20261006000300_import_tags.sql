-- The paid-request import takes each row's tags as a list of names. A name
-- that matches a tag without regard to case or spacing uses that tag, and the
-- rest become new tags, logged like any other. The result counts them.

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
  v_tag_name text;
  v_tag_id uuid;
  v_tag_ids uuid[];
  v_requests integer := 0;
  v_payees integer := 0;
  v_tags integer := 0;
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

      -- Tidied the way guard_tag() tidies, each once, spelled as first seen.
      v_tag_ids := '{}';
      for v_tag_name in
        select distinct on (lower(n.name)) n.name
        from (
          select btrim(regexp_replace(t.value, '\s+', ' ', 'g')) as name, t.ord
          from jsonb_array_elements_text(coalesce(v_row -> 'tags', '[]'::jsonb)) with ordinality as t (value, ord)
        ) n
        where n.name <> ''
        order by lower(n.name), n.ord
      loop
        if char_length(v_tag_name) > 50 then
          raise exception 'Keep each tag to 50 characters or fewer.' using errcode = '22001';
        end if;

        select t.id into v_tag_id
        from public.tags t
        where lower(t.name) = lower(v_tag_name);

        if not found then
          insert into public.tags (name)
          values (v_tag_name)
          returning id into v_tag_id;

          v_tags := v_tags + 1;
        end if;

        v_tag_ids := v_tag_ids || v_tag_id;
      end loop;

      v_request := public.save_request(
        p_request_id => null,
        p_payee_id => v_payee.id,
        p_type => (v_row ->> 'type')::public.reimbursement_type,
        p_purchase_date => v_date,
        p_description => v_row ->> 'notes',
        p_no_receipt => true,
        p_no_receipt_reason => 'Imported from spreadsheet',
        p_lines => jsonb_build_array(
          jsonb_build_object('id', gen_random_uuid(), 'amount_cents', (v_row ->> 'amount_cents')::integer)
        ),
        p_tag_ids => v_tag_ids
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

  return jsonb_build_object('requests', v_requests, 'payees', v_payees, 'tags', v_tags);
end;
$$;
