-- A request is missing a receipt when "No receipt on file" is on, or any of
-- its receipts (lines) has no file. It's a computed field, so the API reads
-- and filters it like a column, and nothing extra is stored.
--
-- It runs as the caller, so it only sees the lines and files their RLS lets
-- them read. The parameter is unnamed so the generated types list it as a
-- column of the request.

create function public.missing_receipt(public.reimbursement_requests)
returns boolean
language sql
stable
set search_path = ''
as $$
  select $1.no_receipt
    or exists (
      select 1
      from public.request_lines l
      where l.request_id = $1.id
        and not exists (select 1 from public.receipts rc where rc.line_id = l.id)
    );
$$;

revoke execute on function public.missing_receipt(public.reimbursement_requests) from public, anon;
grant execute on function public.missing_receipt(public.reimbursement_requests) to authenticated;
