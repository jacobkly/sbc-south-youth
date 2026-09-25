-- Reimbursement requests.
--
-- Clients can insert and edit only the purchase details. Status, approval,
-- and payment columns change only through the status RPCs.

create type public.request_status as enum (
  'draft',
  'submitted',
  'needs_info',
  'approved',
  'paid',
  'rejected',
  'cancelled'
);

create type public.payment_method as enum ('cash_app', 'bank_transfer', 'check', 'cash', 'other');

create type public.reimbursement_type as enum ('cafe', 'youth');

create table public.reimbursement_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  payee_id uuid not null references public.payees (id),
  created_by uuid not null default auth.uid() references public.users (id),
  type public.reimbursement_type not null,
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000), -- up to $1,000,000
  purchase_date date not null check (purchase_date >= date '2000-01-01'),
  vendor text not null check (char_length(trim(vendor)) between 1 and 100),
  description text not null check (char_length(trim(description)) between 1 and 1000),
  event_name text check (event_name is null or char_length(event_name) <= 100),
  status public.request_status not null default 'draft',
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  no_receipt boolean not null default false,
  no_receipt_reason text check (no_receipt_reason is null or char_length(no_receipt_reason) <= 500),
  submitted_at timestamptz,
  approved_by uuid references public.users (id),
  external_approver text check (external_approver is null or char_length(external_approver) <= 100),
  approved_at timestamptz,
  paid_by uuid references public.users (id),
  paid_at timestamptz,
  payment_method public.payment_method,
  payment_reference text check (payment_reference is null or char_length(payment_reference) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_receipt_reason_required check (
    not no_receipt or char_length(trim(coalesce(no_receipt_reason, ''))) > 0
  ),
  constraint paid_requires_payment check (
    status <> 'paid' or (payment_method is not null and paid_at is not null and paid_by is not null)
  )
);

create index reimbursement_requests_payee_id_idx on public.reimbursement_requests (payee_id);
create index reimbursement_requests_created_by_idx on public.reimbursement_requests (created_by);
create index reimbursement_requests_approved_by_idx on public.reimbursement_requests (approved_by);
create index reimbursement_requests_paid_by_idx on public.reimbursement_requests (paid_by);
create index reimbursement_requests_status_idx on public.reimbursement_requests (status);
create index reimbursement_requests_paid_at_idx on public.reimbursement_requests (paid_at);
create index reimbursement_requests_purchase_date_idx on public.reimbursement_requests (purchase_date);

create trigger set_updated_at
  before update on public.reimbursement_requests
  for each row execute function public.set_updated_at();

-- Blocks future dates, keeps the payee and no-receipt columns admin-only, and
-- enforces the self-approval rule no matter which path writes the row.
create function public.guard_reimbursement_request()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
  v_allow_external boolean;
begin
  if (tg_op = 'INSERT' or new.purchase_date is distinct from old.purchase_date)
     and new.purchase_date > v_today then
    raise exception 'The purchase date can''t be in the future.' using errcode = '22023';
  end if;

  if new.paid_at is not null
     and (tg_op = 'INSERT' or new.paid_at is distinct from old.paid_at)
     and (new.paid_at at time zone 'America/Los_Angeles')::date > v_today then
    raise exception 'The paid date can''t be in the future.' using errcode = '22023';
  end if;

  -- Direct writes from signed-in users (not the RPCs, which run as the owner).
  if current_user = 'authenticated' and public.current_app_role() is distinct from 'admin' then
    if tg_op = 'INSERT' and new.no_receipt then
      raise exception 'Only an admin can mark a request as having no receipt.' using errcode = '42501';
    end if;

    if tg_op = 'UPDATE' and (
      new.payee_id is distinct from old.payee_id
      or new.no_receipt is distinct from old.no_receipt
      or new.no_receipt_reason is distinct from old.no_receipt_reason
    ) then
      raise exception 'Only an admin can change the payee or the no-receipt exception.' using errcode = '42501';
    end if;
  end if;

  -- Self-approval: when an approval is recorded for a payee linked to the
  -- approver, an outside approver's name is required, or it's blocked outright
  -- when external approval is turned off.
  if new.approved_at is not null
     and new.approved_by is not null
     and (tg_op = 'INSERT' or old.approved_at is null)
     and exists (
       select 1
       from public.payees p
       where p.id = new.payee_id
         and p.user_id = new.approved_by
     ) then
    select s.allow_external_approval into v_allow_external
    from public.app_settings s
    where s.id = 1;

    if not coalesce(v_allow_external, false) then
      raise exception 'You can''t approve a reimbursement that''s paid to you. Another admin has to approve it.'
        using errcode = '42501';
    end if;

    if nullif(trim(new.external_approver), '') is null then
      raise exception 'This reimbursement is paid to you, so enter the name of the person who approved it.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_reimbursement_request() from public, anon, authenticated;

create trigger guard_reimbursement_request
  before insert or update on public.reimbursement_requests
  for each row execute function public.guard_reimbursement_request();

alter table public.reimbursement_requests enable row level security;

revoke all on table public.reimbursement_requests from anon, authenticated;
revoke all on sequence public.reimbursement_requests_request_number_seq from anon, authenticated;
grant select, delete on table public.reimbursement_requests to authenticated;
grant insert (
  payee_id,
  type,
  amount_cents,
  purchase_date,
  vendor,
  description,
  event_name,
  no_receipt,
  no_receipt_reason
) on table public.reimbursement_requests to authenticated;
grant update (
  payee_id,
  type,
  amount_cents,
  purchase_date,
  vendor,
  description,
  event_name,
  no_receipt,
  no_receipt_reason
) on table public.reimbursement_requests to authenticated;

create policy "Admins read all requests; viewers read non-drafts"
  on public.reimbursement_requests for select
  to authenticated
  using (
    (select public.current_app_role()) = 'admin'
    or ((select public.current_app_role()) = 'viewer' and status <> 'draft')
  );

create policy "Admins create draft requests"
  on public.reimbursement_requests for insert
  to authenticated
  with check (
    (select public.current_app_role()) = 'admin'
    and created_by = (select auth.uid())
    and status = 'draft'
  );

create policy "Admins edit open requests"
  on public.reimbursement_requests for update
  to authenticated
  using (
    (select public.current_app_role()) = 'admin'
    and status in ('draft', 'submitted', 'needs_info')
  )
  with check (
    (select public.current_app_role()) = 'admin'
    and status in ('draft', 'submitted', 'needs_info')
  );

create policy "Admins delete their own drafts"
  on public.reimbursement_requests for delete
  to authenticated
  using (
    (select public.current_app_role()) = 'admin'
    and status = 'draft'
    and created_by = (select auth.uid())
  );
