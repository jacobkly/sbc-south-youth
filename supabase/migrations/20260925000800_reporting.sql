-- Reporting view: requests with the Los Angeles date each one was paid, so
-- the dashboard and reports can filter and group paid requests by plain
-- dates. purchase_date is already a plain date.
--
-- security_invoker makes the view read the table as the caller, so the
-- requests table's RLS still applies: viewers never see drafts, and anyone
-- without an admin or viewer role sees nothing.

create view public.request_report
with (security_invoker = true)
as
select
  r.id,
  r.request_number,
  r.status,
  r.type,
  r.amount_cents,
  r.purchase_date,
  (r.paid_at at time zone 'America/Los_Angeles')::date as paid_date,
  r.payee_id,
  r.created_by,
  r.vendor,
  r.description,
  r.event_name,
  r.no_receipt,
  r.no_receipt_reason,
  r.submitted_at,
  r.approved_by,
  r.external_approver,
  r.approved_at,
  r.paid_by,
  r.paid_at,
  r.payment_method,
  r.payment_reference
from public.reimbursement_requests r;

-- Supabase grants new relations to anon and authenticated by default.
revoke all on table public.request_report from anon, authenticated;
grant select on table public.request_report to authenticated;
