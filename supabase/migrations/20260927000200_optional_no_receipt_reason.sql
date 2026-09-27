-- The no-receipt exception no longer needs a reason: asking for one on every
-- lost receipt was friction. A reason that's given still can't be blank, so
-- a blank one is stored as null, like a blank vendor.

update public.reimbursement_requests
set no_receipt_reason = null
where no_receipt_reason is not null
  and char_length(trim(no_receipt_reason)) = 0;

alter table public.reimbursement_requests
  drop constraint no_receipt_reason_required,
  add constraint no_receipt_reason_not_blank check (
    no_receipt_reason is null or char_length(trim(no_receipt_reason)) > 0
  );

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
    raise exception 'Add at least one receipt, or mark it as having no receipt.'
      using errcode = '23514';
  end if;
end;
$$;
