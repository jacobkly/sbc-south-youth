-- Schema-wide security checks on public and site, so a new table, function,
-- or policy can't quietly skip the rules: RLS everywhere, nothing for anon,
-- pinned search paths, and a known list of functions clients can call.
begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

select tables_are(
  'public',
  array['users', 'app_settings', 'payees', 'reimbursement_requests', 'request_events', 'receipts', 'request_lines', 'activity_log',
        'email_log', 'email_suppressions', 'invites'],
  'public has only the known tables (add new ones here once they have RLS and tests)'
);

select tables_are(
  'site',
  array['posts', 'events', 'messages', 'form_rate_limits'],
  'site has only the known tables (add new ones here once they have RLS and tests)'
);

select is_empty(
  $$ select c.relname from pg_class c
     where c.relnamespace in ('public'::regnamespace, 'site'::regnamespace)
       and c.relkind in ('r', 'p')
       and not c.relrowsecurity $$,
  'every table has RLS turned on'
);

select is_empty(
  $$ select c.relname, p.privilege
     from pg_class c
     cross join unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) as p (privilege)
     where c.relnamespace in ('public'::regnamespace, 'site'::regnamespace)
       and c.relkind in ('r', 'p', 'v', 'm')
       and has_table_privilege('anon', c.oid, p.privilege) $$,
  'anon has no privileges on any table or view'
);

select is_empty(
  $$ select c.relname, p.privilege
     from pg_class c
     cross join unnest(array['truncate', 'references', 'trigger']) as p (privilege)
     where c.relnamespace in ('public'::regnamespace, 'site'::regnamespace)
       and c.relkind in ('r', 'p', 'v', 'm')
       and has_table_privilege('authenticated', c.oid, p.privilege) $$,
  'signed-in users can''t truncate, reference, or add triggers to any table'
);

select is_empty(
  $$ select c.relname
     from pg_class c
     where c.relnamespace in ('public'::regnamespace, 'site'::regnamespace)
       and c.relkind = 'S'
       and (has_sequence_privilege('anon', c.oid, 'usage') or has_sequence_privilege('authenticated', c.oid, 'usage')) $$,
  'clients can''t use any sequence'
);

select is_empty(
  $$ select p.proname from pg_proc p
     where p.pronamespace in ('public'::regnamespace, 'site'::regnamespace)
       and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon can''t call any function'
);

select set_eq(
  $$ select p.proname::text from pg_proc p
     where p.pronamespace in ('public'::regnamespace, 'site'::regnamespace)
       and has_function_privilege('authenticated', p.oid, 'execute') $$,
  array[
    'current_app_role',
    'has_role',
    'set_roles',
    'record_invite',
    'accept_invite',
    'remove_access',
    'reinstate',
    'touch_last_seen',
    'people_directory',
    'log_event',
    'email_unsuppress',
    'current_payee_id',
    'set_member_role',
    'set_member_active',
    'link_payee',
    'unlink_payee',
    'storage_usage',
    'storage_summary',
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
    'save_request',
    'missing_receipt',
    'triage_message'
  ],
  'signed-in users can call only the app''s RPCs (helpers and trigger functions stay private)'
);

select is_empty(
  $$ select p.proname from pg_proc p
     where p.pronamespace in ('public'::regnamespace, 'site'::regnamespace)
       and not coalesce(p.proconfig, '{}') @> array['search_path=""'] $$,
  'every function pins search_path to empty'
);

select is_empty(
  $$ select tablename, policyname from pg_policies
     where schemaname in ('public', 'site') and roles <> array['authenticated']::name[] $$,
  'every policy in public and site applies to signed-in users only'
);

select policies_are(
  'storage',
  'objects',
  array[
    'Receipt files are readable with their request',
    'Admins upload receipt files to open requests',
    'Admins delete receipt files from open requests',
    'Requesters upload receipt files to their editable requests',
    'Requesters delete receipt files from their editable requests',
    'Avatars are readable by their owner and portal roles',
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
-- each table as them. users.test.sql covers their own users row. A site
-- editor reads nothing from finances either, even linked to the payee.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'former@example.test', '{"full_name": "Former Admin"}'),
  ('00000000-0000-4000-8000-00000000a002', 'editor@example.test', '{"full_name": "Site Editor"}');

update public.users set role = 'admin', is_active = false
where id = '00000000-0000-4000-8000-00000000a001';

update public.users set roles = '{site_editor}'
where id = '00000000-0000-4000-8000-00000000a002';

insert into public.payees (id, full_name, user_id, linked_at)
values ('00000000-0000-4000-8000-00000000b001', 'Test Payee', '00000000-0000-4000-8000-00000000a002', now());

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

insert into public.email_log (id, template, priority, scope, to_address, status, resend_id)
values ('00000000-0000-4000-8000-00000000e001', 'invite', 2, 'platform', 'invitee@example.test', 'sent', 're_security');

insert into public.email_suppressions (address, reason, email_log_id)
values ('invitee@example.test', 'bounced', '00000000-0000-4000-8000-00000000e001');

insert into public.invites (user_id, email, full_name, roles)
values ('00000000-0000-4000-8000-00000000a001', 'former@example.test', 'Former Admin', '{owner}');

insert into site.posts (id, title, body, status)
values ('00000000-0000-4000-8000-00000000a501', 'Test heads-up', 'Showing now.', 'published');

insert into site.events (id, slug, title, starts_at, ends_at, status)
values ('00000000-0000-4000-8000-00000000a502', 'security-test', 'Test event', now(), now(), 'published');

insert into site.messages (id, kind, name, email)
values ('00000000-0000-4000-8000-00000000a503', 'visit', 'Test Visitor', 'visitor@example.test');

insert into site.form_rate_limits (ip_hash) values (repeat('e', 64));

select ok(
  exists (select 1 from public.app_settings)
  and exists (select 1 from public.payees where id = '00000000-0000-4000-8000-00000000b001')
  and exists (select 1 from public.reimbursement_requests where id = '00000000-0000-4000-8000-00000000c001')
  and exists (select 1 from public.request_events where request_id = '00000000-0000-4000-8000-00000000c001')
  and exists (select 1 from public.request_lines where request_id = '00000000-0000-4000-8000-00000000c001')
  and exists (select 1 from public.receipts where id = '00000000-0000-4000-8000-00000000d001')
  and exists (select 1 from public.activity_log where entity_id = '00000000-0000-4000-8000-00000000a001')
  and exists (select 1 from public.email_log where id = '00000000-0000-4000-8000-00000000e001')
  and exists (select 1 from public.email_suppressions where address = 'invitee@example.test')
  and exists (select 1 from public.invites where user_id = '00000000-0000-4000-8000-00000000a001')
  and exists (select 1 from site.posts where id = '00000000-0000-4000-8000-00000000a501')
  and exists (select 1 from site.events where id = '00000000-0000-4000-8000-00000000a502')
  and exists (select 1 from site.messages where id = '00000000-0000-4000-8000-00000000a503')
  and exists (select 1 from site.form_rate_limits)
  and exists (select 1 from storage.objects where bucket_id = 'receipts'),
  'every table has a row for the deactivated admin to be refused'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);

-- Signed-in people can't select from the rate limits at all, so they're left out.
select is_empty(
  format('select 1 from %I.%I', n.nspname, c.relname),
  format('a deactivated admin reads nothing from %s', c.relname)
)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'site') and c.relkind in ('r', 'p') and c.relname not in ('users', 'form_rate_limits');

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'receipts' $$,
  'a deactivated admin reads no receipt files'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a002", "role": "authenticated"}', true);

select is_empty(
  format('select 1 from public.%I', t.name),
  format('a site editor reads nothing from %s', t.name)
)
from unnest(array[
  'app_settings', 'payees', 'reimbursement_requests', 'request_events', 'request_lines', 'receipts', 'request_report'
]) as t (name);

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'receipts' $$,
  'a site editor reads no receipt files'
);

reset role;

select * from finish();
rollback;
