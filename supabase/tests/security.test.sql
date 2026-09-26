-- Schema-wide security checks, so a new table, function, or policy can't
-- quietly skip the rules: RLS everywhere, nothing for anon, pinned search
-- paths, and a known list of functions clients can call.
begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select tables_are(
  'public',
  array['users', 'app_settings', 'payees', 'reimbursement_requests', 'request_events', 'receipts'],
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
    'import_paid_requests'
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
    'Admins delete receipt files from open requests'
  ],
  'storage has only the receipt file policies'
);

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects' and roles <> array['authenticated']::name[] $$,
  'every receipt file policy applies to signed-in users only'
);

select * from finish();
rollback;
