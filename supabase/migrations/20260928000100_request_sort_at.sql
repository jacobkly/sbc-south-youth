-- Lists of requests go by the day each was paid back, or the day it was
-- created while it's unpaid. Paying back old receipts today puts them at the
-- top, not back among their purchase dates. It's stored and indexed so the
-- API can sort and page by it.

alter table public.reimbursement_requests
  add column sort_at timestamptz generated always as (coalesce(paid_at, created_at)) stored;

create index reimbursement_requests_sort_at_idx
  on public.reimbursement_requests (sort_at desc, request_number desc);
