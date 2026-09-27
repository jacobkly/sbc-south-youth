-- Schema-wide security checks, so a new table, function, or policy can't
-- quietly skip the rules: RLS everywhere, nothing for anon, pinned search
-- paths, and a known list of functions clients can call.
begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select tables_are(
  'public',
  array['users', 'app_settings', 'payees', 'reimbursement_requests', 'request_events', 'receipts', 'request_lines'],
  'public has only the known tables (add new ones here once they have RLS and tests)'
);

select is_empty(
  $$ select c.relname from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every table has RLS turned on'
);

select is_empty(
  $$ select c.relname, p.privilege
     from pg_class c
     cross join unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) as p (privilege)
     where c.relnamespace = 'public'::regnamespace
       and c.relkind in ('r', 'p', 'v', 'm')
       and has_table_privilege('anon', c.oid, p.privilege) $$,
  'anon has no privileges on any table or view'
);

select is_empty(
  $$ select c.relname, p.privilege
     from pg_class c
     cross join unnest(array['truncate', 'references', 'trigger']) as p (privilege)
     where c.relnamespace = 'public'::regnamespace
       and c.relkind in ('r', 'p', 'v', 'm')
       and has_table_privilege('authenticated', c.oid, p.privilege) $$,
  'signed-in users can''t truncate, reference, or add triggers to any table'
);

select is_empty(
  $$ select c.relname
     from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relkind = 'S'
       and (has_sequence_privilege('anon', c.oid, 'usage') or has_sequence_privilege('authenticated', c.oid, 'usage')) $$,
  'clients can''t use any sequence'
);

select is_empty(
  $$ select p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon can''t call any function'
);

select set_eq(
  $$ select p.proname::text from pg_proc p
     where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute') $$,
  array[
    'current_app_role',
    'current_payee_id',
    'set_member_role',
    'set_member_active',
    'link_payee',
    'unlink_payee',
    'storage_usage',
    'submit_request',
    'approve_request',
    'record_as_paid',
    'mark_paid',
    'unmark_paid',
    'unapprove_request',
    'request_info',
    'reject_request',
    'cancel_request',
    'import_paid_requests',
    'save_request'
  ],
  'signed-in users can call only the app''s RPCs (helpers and trigger functions stay private)'
);

select is_empty(
  $$ select p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and not coalesce(p.proconfig, '{}') @> array['search_path=""'] $$,
  'every function pins search_path to empty'
);

select is_empty(
  $$ select tablename, policyname from pg_policies
     where schemaname = 'public' and roles <> array['authenticated']::name[] $$,
  'every policy in public applies to signed-in users only'
);

select policies_are(
  'storage',
  'objects',
  array[
    'Receipt files are readable with their request',
    'Admins upload receipt files to open requests',
    'Admins delete receipt files from open requests',
    'Avatars are readable by their owner, admins, and viewers',
    'Active users upload their own avatar',
    'Active users delete their own avatars'
  ],
  'storage has only the receipt and avatar file policies'
);

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects' and roles <> array['authenticated']::name[] $$,
  'every file policy applies to signed-in users only'
);

select is_empty(
  $$ select id from storage.buckets where public $$,
  'every bucket is private'
);

-- A deactivated admin reads nothing: one row in every table, then a check of
-- each table as them. users.test.sql covers their own users row.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-00000000a001', 'former@example.test', '{"full_name": "Former Admin"}');

update public.users set role = 'admin', is_active = false
where id = '00000000-0000-4000-8000-00000000a001';

insert into public.payees (id, full_name)
values ('00000000-0000-4000-8000-00000000b001', 'Test Payee');

insert into public.reimbursement_requests (
  id, payee_id, created_by, type, amount_cents, purchase_date, vendor, description, status, submitted_at
) values (
  '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000b001',
  '00000000-0000-4000-8000-00000000a001', 'youth', 1000, '2026-01-10', 'Fake Store', 'Submitted',
  'submitted', now()
);

insert into public.request_lines (id, request_id, position, amount_cents, vendor)
values ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000c001', 1, 1000, 'Fake Store');

insert into public.receipts (id, request_id, line_id, storage_path, original_filename, mime_type, size_bytes, sha256)
values (
  '00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000f001',
  '00000000-0000-4000-8000-00000000c001/00000000-0000-4000-8000-00000000d001.jpg',
  'receipt.jpg', 'image/jpeg', 1000, repeat('a', 64)
);

insert into storage.objects (bucket_id, name)
values ('receipts', '00000000-0000-4000-8000-00000000c001/00000000-0000-4000-8000-00000000d001.jpg');

select ok(
  exists (select 1 from public.app_settings)
  and exists (select 1 from public.payees where id = '00000000-0000-4000-8000-00000000b001')
  and exists (select 1 from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c001')
  and exists (select 1 from public.request_events where request_id = '00000000-0000-4000-8000-00000000c001')
  and exists (select 1 from public.request_lines where request_id = '00000000-0000-4000-8000-00000000c001')
  and exists (select 1 from public.receipts where id = '00000000-0000-4000-8000-00000000d001')
  and exists (select 1 from storage.objects where bucket_id = 'receipts'),
  'every table has a row for the deactivated admin to be refused'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

select is_empty(
  format('select 1 from public.%I', c.relname),
  format('a deactivated admin reads nothing from %s', c.relname)
)
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and c.relname <> 'users';

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'receipts' $$,
  'a deactivated admin reads no receipt files'
);

reset role;

select * from finish();
rollback;
