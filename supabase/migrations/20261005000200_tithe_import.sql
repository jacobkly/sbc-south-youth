-- Importing tithes from a spreadsheet. An owner with two-step sign-in sends
-- each row's date and amount, and one way they all came in. Every row is
-- saved as a tithe, or none are, and the error names the row that stopped it.
--
-- The import is one entry in the finance history, with how many, how much,
-- how, and the dates it covers, instead of one entry per tithe. It quiets the
-- per-row log with a transaction-local setting (app.importing_tithes) for the
-- length of its own call.

-- The same as before, except that tithes added by an import aren't logged one
-- by one.
drop trigger log_activity on public.youth_income;

create trigger log_activity
  after insert or update or delete on public.youth_income
  for each row
  when (current_setting('app.importing_tithes', true) is distinct from 'on')
  execute function public.log_activity(
    'finances', 'youth_income', 'event_name', 'kind', 'received_on', 'amount_cents', 'method', 'event_name'
  );

-- Takes rows of {line, date, amount_cents}, where line is the row's number in
-- the spreadsheet, and returns how many tithes it added and their total.
create function public.import_tithes(p_rows jsonb, p_method public.income_method)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_line integer;
  v_date date;
  v_count integer := 0;
  v_total bigint := 0;
  v_first date;
  v_last date;
begin
  if not public.has_role('owner') then
    raise exception 'Only an owner can import tithes.' using errcode = '42501';
  end if;

  perform public.require_aal2();

  if p_method is null then
    raise exception 'Choose how they came in.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'There are no rows to import.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Import at most 2,000 rows at a time.' using errcode = '22023';
  end if;

  perform set_config('app.importing_tithes', 'on', true);

  for v_row in select r.value from jsonb_array_elements(p_rows) as r loop
    v_line := null;

    begin
      v_line := v_row ->> 'line';
      v_date := v_row ->> 'date';

      insert into public.youth_income (kind, received_on, amount_cents, method)
      values ('tithe', v_date, (v_row ->> 'amount_cents')::integer, p_method);

      v_count := v_count + 1;
      v_total := v_total + (v_row ->> 'amount_cents')::integer;
      v_first := least(v_first, v_date);
      v_last := greatest(v_last, v_date);
    exception
      when others then
        -- The app's own messages are sentences worth showing. Anything else
        -- (a bad cast or a failed check) gets a plain message.
        if sqlerrm ~ '^[A-Z].*\.$' then
          raise exception 'Row %: %', coalesce(v_line::text, '?'), sqlerrm using errcode = sqlstate;
        end if;

        raise exception 'Row % couldn''t be imported. Check its date and amount.', coalesce(v_line::text, '?')
          using errcode = '22023';
    end;
  end loop;

  perform set_config('app.importing_tithes', '', true);

  insert into public.activity_log (actor_id, scope, action, entity_type, changes)
  values (
    auth.uid(),
    'finances',
    'youth_income.imported',
    'youth_income',
    jsonb_build_object(
      'count', v_count,
      'total_cents', v_total,
      'method', p_method,
      'first_on', v_first,
      'last_on', v_last
    )
  );

  return jsonb_build_object('tithes', v_count, 'total_cents', v_total);
end;
$$;

revoke execute on function public.import_tithes(jsonb, public.income_method) from public, anon;
grant execute on function public.import_tithes(jsonb, public.income_method) to authenticated;
