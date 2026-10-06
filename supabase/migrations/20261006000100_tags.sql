-- Tags on requests, in place of the one free-text event name. A request can
-- have up to 10, so a retreat's gas, food, and deposit can all say "Fall
-- retreat", and one can also say "Van". Each request's event name becomes a
-- tag here, with names that differ only in case or spacing becoming one tag.
--
-- Owners with two-step sign-in make, rename, and delete tags, and tag any
-- request in any status. Owners and finance viewers see them. Requesters
-- never do, not even on their own requests, and their request history leaves
-- out tag changes.
--
-- event_name stays for now and is no longer written, so the app that's
-- already deployed keeps working until the new one is. save_request() and
-- correct_request() still take p_event_name, now optional and ignored. A
-- later migration drops the column and the parameter.

-- Tags.
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 50 and name = btrim(name)),
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tags is
  'Labels on requests, like an event or a ministry. Owners and finance viewers see them; requesters never do.';

create unique index tags_name_key on public.tags (lower(name));

create trigger set_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

-- Tidies the name and says what's wrong in words the app can show. The checks
-- on the table back these up.
create function public.guard_tag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));

  if new.name = '' then
    raise exception 'Enter a name.' using errcode = '22023';
  end if;

  if char_length(new.name) > 50 then
    raise exception 'Keep the name to 50 characters or fewer.' using errcode = '22001';
  end if;

  if exists (
    select 1 from public.tags t
    where lower(t.name) = lower(new.name) and t.id <> new.id
  ) then
    raise exception 'There''s already a tag called %.', new.name using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_tag() from public, anon, authenticated;

create trigger guard_tag
  before insert or update on public.tags
  for each row execute function public.guard_tag();

-- Which requests have which tags. Written only by write_request_tags().
create table public.request_tags (
  request_id uuid not null references public.reimbursement_requests (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, tag_id)
);

comment on table public.request_tags is
  'The tags on each request. Changed only through save_request() and set_request_tags().';

create index request_tags_tag_id_idx on public.request_tags (tag_id);

-- Event names become tags, spelled the way the newest request spelled them.
-- Nothing here is logged: the requests haven't changed, only where the name
-- is kept.
insert into public.tags (name)
select distinct on (lower(n.name)) n.name
from (
  select btrim(left(regexp_replace(btrim(r.event_name), '\s+', ' ', 'g'), 50)) as name, r.created_at
  from public.reimbursement_requests r
  where nullif(btrim(r.event_name), '') is not null
) n
order by lower(n.name), n.created_at desc;

insert into public.request_tags (request_id, tag_id)
select r.id, t.id
from public.reimbursement_requests r
join public.tags t
  on lower(t.name) = lower(btrim(left(regexp_replace(btrim(r.event_name), '\s+', ' ', 'g'), 50)))
where nullif(btrim(r.event_name), '') is not null;

-- History. From here on, making, renaming, and deleting a tag is finance
-- activity, which is never pruned.
create trigger log_activity
  after insert or update or delete on public.tags
  for each row execute function public.log_activity('finances', 'tag', 'name', 'name');

-- Access.
alter table public.tags enable row level security;
alter table public.request_tags enable row level security;

revoke all on table public.tags from public, anon, authenticated, service_role;
grant select, delete on table public.tags to authenticated;
grant insert (id, name) on table public.tags to authenticated;
grant update (name) on table public.tags to authenticated;

revoke all on table public.request_tags from public, anon, authenticated, service_role;
grant select on table public.request_tags to authenticated;

create policy "Owners and finance viewers read tags"
  on public.tags for select
  to authenticated
  using ((select public.has_role('finance_viewer')));

create policy "Owners add tags"
  on public.tags for insert
  to authenticated
  with check ((select public.has_role('owner')) and (select auth.jwt() ->> 'aal') = 'aal2');

create policy "Owners rename tags"
  on public.tags for update
  to authenticated
  using ((select public.has_role('owner')) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select public.has_role('owner')) and (select auth.jwt() ->> 'aal') = 'aal2');

-- Deleting a tag takes it off every request.
create policy "Owners delete tags"
  on public.tags for delete
  to authenticated
  using ((select public.has_role('owner')) and (select auth.jwt() ->> 'aal') = 'aal2');

-- Readable with the request, so a finance viewer never sees a draft's tags.
create policy "Owners and finance viewers read request tags"
  on public.request_tags for select
  to authenticated
  using (
    (select public.has_role('finance_viewer'))
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id = request_tags.request_id
    )
  );

-- A request's history notes each change to its tags, which requesters don't
-- see.
alter table public.request_events
  drop constraint request_events_action_check,
  add constraint request_events_action_check check (action in (
    'created',
    'updated',
    'submitted',
    'approved',
    'recorded_paid',
    'info_requested',
    'rejected',
    'cancelled',
    'unapproved',
    'paid',
    'unpaid',
    'receipt_added',
    'receipt_removed',
    'corrected',
    'tagged'
  ));

drop policy "Events are readable with their request" on public.request_events;

create policy "Events are readable with their request"
  on public.request_events for select
  to authenticated
  using (
    (action <> 'tagged' or (select public.has_role('finance_viewer')))
    and exists (
      select 1
      from public.reimbursement_requests r
      where r.id = request_events.request_id
    )
  );

-- Sets a request's tags to exactly these, and with p_log, notes the change in
-- its history by name, as the names were then. Callers check who's asking and
-- lock the request first.
create function public.write_request_tags(p_request_id uuid, p_tag_ids uuid[], p_log boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_before jsonb;
  v_after jsonb;
begin
  select coalesce(array_agg(distinct i), '{}')
  into v_ids
  from unnest(p_tag_ids) as i
  where i is not null;

  if cardinality(v_ids) > 10 then
    raise exception 'A request can have at most 10 tags.' using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(v_ids) as i
    where not exists (select 1 from public.tags t where t.id = i)
  ) then
    raise exception 'That tag was deleted. Reload and try again.' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(t.name order by lower(t.name)), '[]'::jsonb)
  into v_before
  from public.request_tags rt
  join public.tags t on t.id = rt.tag_id
  where rt.request_id = p_request_id;

  delete from public.request_tags rt
  where rt.request_id = p_request_id
    and rt.tag_id <> all (v_ids);

  insert into public.request_tags (request_id, tag_id)
  select p_request_id, i
  from unnest(v_ids) as i
  on conflict do nothing;

  select coalesce(jsonb_agg(t.name order by lower(t.name)), '[]'::jsonb)
  into v_after
  from public.request_tags rt
  join public.tags t on t.id = rt.tag_id
  where rt.request_id = p_request_id;

  if p_log and v_before is distinct from v_after then
    insert into public.request_events (request_id, actor_id, action, from_status, to_status, changes)
    select r.id, auth.uid(), 'tagged', r.status, r.status,
      jsonb_build_object('tags', jsonb_build_object('from', v_before, 'to', v_after))
    from public.reimbursement_requests r
    where r.id = p_request_id;
  end if;
end;
$$;

revoke execute on function public.write_request_tags(uuid, uuid[], boolean) from public, anon, authenticated;

-- Changes a request's tags, in any status, since a tag only labels it.
create function public.set_request_tags(p_request_id uuid, p_tag_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner') then
    raise exception 'Only an owner can tag requests.' using errcode = '42501';
  end if;

  perform public.require_aal2();
  perform public.lock_request(p_request_id);
  perform public.write_request_tags(p_request_id, p_tag_ids, true);
end;
$$;

revoke execute on function public.set_request_tags(uuid, uuid[]) from public, anon;
grant execute on function public.set_request_tags(uuid, uuid[]) to authenticated;

-- The same as before, except that it no longer writes the event name, and an
-- owner can pass the tags. Left out, the tags stay as they are, which is how
-- requesters always save. A new request's tags are part of its creation, so
-- only a change to an existing request's tags is logged.
drop function public.save_request(
  uuid, uuid, public.reimbursement_type, date, text, text, boolean, text, jsonb
);

create function public.save_request(
  p_request_id uuid,
  p_payee_id uuid,
  p_type public.reimbursement_type,
  p_purchase_date date,
  p_description text,
  p_event_name text default null,
  p_no_receipt boolean default false,
  p_no_receipt_reason text default null,
  p_lines jsonb default null,
  p_tag_ids uuid[] default null
)
returns public.reimbursement_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reimbursement_requests;
  v_ids uuid[];
  v_amounts integer[];
  v_vendors text[];
  v_total bigint;
  v_owner boolean := public.has_role('owner');
  v_payee_id uuid := public.current_payee_id();
  v_no_receipt boolean := false;
  v_no_receipt_reason text;
begin
  if not public.has_role('finance_requester') then
    raise exception 'You don''t have permission to save requests.' using errcode = '42501';
  end if;

  if p_tag_ids is not null then
    if not v_owner then
      raise exception 'Only an owner can tag requests.' using errcode = '42501';
    end if;

    perform public.require_aal2();
  end if;

  -- Owners save for anyone and can use the no-receipt exception. Requesters
  -- save only requests paid to them, and never change the exception.
  if v_owner then
    v_no_receipt := coalesce(p_no_receipt, false);
    v_no_receipt_reason := case when v_no_receipt then nullif(trim(p_no_receipt_reason), '') end;
  elsif v_payee_id is null then
    raise exception 'Your account isn''t linked to a payee yet. Ask an owner to link it.' using errcode = '42501';
  elsif p_payee_id is distinct from v_payee_id then
    raise exception 'You can only save requests paid to you.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Enter an amount.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_lines) > 10 then
    raise exception 'A request can have at most 10 receipts.' using errcode = '22023';
  end if;

  select
    array_agg((e.value ->> 'id')::uuid order by e.ord),
    array_agg((e.value ->> 'amount_cents')::integer order by e.ord),
    array_agg(nullif(trim(e.value ->> 'vendor'), '') order by e.ord)
  into v_ids, v_amounts, v_vendors
  from jsonb_array_elements(p_lines) with ordinality as e (value, ord);

  if array_position(v_ids, null) is not null
     or (select count(distinct i) from unnest(v_ids) as i) <> cardinality(v_ids) then
    raise exception 'Each receipt needs its own id.' using errcode = '22023';
  end if;

  if exists (select 1 from unnest(v_amounts) as a where a is null or a <= 0) then
    raise exception 'Each receipt needs an amount more than $0.' using errcode = '23514';
  end if;

  if exists (select 1 from unnest(v_amounts) as a where a > 100000000) then
    raise exception 'A receipt can''t be more than $1,000,000.' using errcode = '23514';
  end if;

  select sum(a) into v_total from unnest(v_amounts) as a;
  if v_total > 100000000 then
    raise exception 'The total can''t be more than $1,000,000.' using errcode = '23514';
  end if;

  if exists (select 1 from unnest(v_vendors) as v where char_length(v) > 100) then
    raise exception 'A vendor can be at most 100 characters.' using errcode = '23514';
  end if;

  if p_request_id is null then
    insert into public.reimbursement_requests (
      payee_id,
      created_by,
      type,
      amount_cents,
      purchase_date,
      vendor,
      description,
      no_receipt,
      no_receipt_reason
    ) values (
      p_payee_id,
      auth.uid(),
      p_type,
      v_total,
      p_purchase_date,
      public.vendor_list(v_vendors),
      nullif(trim(p_description), ''),
      v_no_receipt,
      v_no_receipt_reason
    )
    returning * into v_request;
  else
    v_request := public.lock_request(p_request_id);

    if v_owner then
      -- correct_request() opens an approved or paid request for the length of its call.
      if v_request.status not in ('draft', 'submitted', 'needs_info')
         and current_setting('app.correcting', true) is distinct from v_request.id::text then
        raise exception 'This request can''t be edited anymore.' using errcode = '55000';
      end if;
    else
      if v_request.payee_id is distinct from v_payee_id then
        raise exception 'That request doesn''t exist.' using errcode = 'P0002';
      end if;

      if v_request.status not in ('draft', 'needs_info') then
        raise exception 'Only a draft or a request that needs info can be edited.' using errcode = '55000';
      end if;

      v_no_receipt := v_request.no_receipt;
      v_no_receipt_reason := v_request.no_receipt_reason;
    end if;

    perform set_config(
      'app.lines_before',
      jsonb_build_object('request_id', v_request.id, 'lines', public.request_lines_summary(v_request.id))::text,
      true
    );
  end if;

  if exists (
    select 1
    from public.request_lines l
    where l.id = any (v_ids)
      and l.request_id <> v_request.id
  ) then
    raise exception 'That receipt is on another request.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.receipts rc
    where rc.request_id = v_request.id
      and rc.line_id <> all (v_ids)
  ) then
    raise exception 'Remove a receipt''s files before removing the receipt.' using errcode = '55000';
  end if;

  delete from public.request_lines l
  where l.request_id = v_request.id
    and l.id <> all (v_ids);

  update public.request_lines l
  set position = u.ord,
      amount_cents = u.amount_cents,
      vendor = u.vendor
  from unnest(v_ids, v_amounts, v_vendors) with ordinality as u (id, amount_cents, vendor, ord)
  where l.id = u.id
    and l.request_id = v_request.id
    and (l.position, l.amount_cents, l.vendor) is distinct from (u.ord::smallint, u.amount_cents, u.vendor);

  insert into public.request_lines (id, request_id, position, amount_cents, vendor)
  select u.id, v_request.id, u.ord, u.amount_cents, u.vendor
  from unnest(v_ids, v_amounts, v_vendors) with ordinality as u (id, amount_cents, vendor, ord)
  where not exists (select 1 from public.request_lines l where l.id = u.id);

  if p_request_id is not null then
    update public.reimbursement_requests
    set payee_id = p_payee_id,
        type = p_type,
        amount_cents = v_total,
        purchase_date = p_purchase_date,
        vendor = public.vendor_list(v_vendors),
        description = nullif(trim(p_description), ''),
        no_receipt = v_no_receipt,
        no_receipt_reason = v_no_receipt_reason
    where id = v_request.id
    returning * into v_request;

    perform set_config('app.lines_before', '', true);
  end if;

  if p_tag_ids is not null then
    perform public.write_request_tags(v_request.id, p_tag_ids, p_request_id is not null);
  end if;

  return v_request;
end;
$$;

revoke execute on function public.save_request(
  uuid, uuid, public.reimbursement_type, date, text, text, boolean, text, jsonb, uuid[]
) from public, anon;
grant execute on function public.save_request(
  uuid, uuid, public.reimbursement_type, date, text, text, boolean, text, jsonb, uuid[]
) to authenticated;

-- Only so p_event_name can be left out. A parameter with a default needs every
-- one after it to have one too, and each still says what's missing in words.
create or replace function public.correct_request(
  p_request_id uuid,
  p_type public.reimbursement_type,
  p_purchase_date date,
  p_description text,
  p_event_name text default null,
  p_no_receipt boolean default false,
  p_no_receipt_reason text default null,
  p_lines jsonb default null,
  p_paid_at timestamptz default null,
  p_payment_method public.payment_method default null,
  p_payment_reference text default null,
  p_reason text default null
)
returns public.reimbursement_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := trim(p_reason);
  v_before public.reimbursement_requests;
  v_after public.reimbursement_requests;
  v_lines_before jsonb;
  v_lines_after jsonb;
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb;
begin
  if not public.has_role('owner') then
    raise exception 'Only an owner can correct requests.' using errcode = '42501';
  end if;

  perform public.require_aal2();

  if nullif(v_reason, '') is null then
    raise exception 'Say what was wrong.' using errcode = '22023';
  end if;

  if char_length(v_reason) > 1000 then
    raise exception 'Keep the reason to 1,000 characters or fewer.' using errcode = '22001';
  end if;

  v_before := public.lock_request(p_request_id);

  if v_before.status not in ('approved', 'paid') then
    raise exception 'Only an approved or paid request can be corrected.' using errcode = '55000';
  end if;

  if v_before.status = 'paid' then
    if p_payment_method is null then
      raise exception 'Choose how it was paid.' using errcode = '22023';
    end if;

    if p_paid_at is null then
      raise exception 'Enter the date it was paid.' using errcode = '22023';
    end if;

    if char_length(trim(p_payment_reference)) > 200 then
      raise exception 'Keep the reference to 200 characters or fewer.' using errcode = '22001';
    end if;
  elsif p_paid_at is not null
     or p_payment_method is not null
     or nullif(trim(p_payment_reference), '') is not null then
    raise exception 'Only a paid request has a payment to correct.' using errcode = '22023';
  end if;

  v_lines_before := public.request_lines_summary(p_request_id);

  perform set_config('app.correcting', p_request_id::text, true);

  perform public.save_request(
    p_request_id => p_request_id,
    p_payee_id => v_before.payee_id,
    p_type => p_type,
    p_purchase_date => p_purchase_date,
    p_description => p_description,
    p_no_receipt => p_no_receipt,
    p_no_receipt_reason => p_no_receipt_reason,
    p_lines => p_lines
  );

  if v_before.status = 'paid' then
    update public.reimbursement_requests
    set paid_at = p_paid_at,
        payment_method = p_payment_method,
        payment_reference = nullif(trim(p_payment_reference), '')
    where id = p_request_id;
  end if;

  perform set_config('app.correcting', '', true);

  select * into v_after
  from public.reimbursement_requests r
  where r.id = p_request_id;

  v_old := to_jsonb(v_before);
  v_new := to_jsonb(v_after);

  select jsonb_object_agg(f.field, jsonb_build_object('from', v_old -> f.field, 'to', v_new -> f.field))
  into v_changes
  from unnest(array[
    'type',
    'amount_cents',
    'purchase_date',
    'vendor',
    'description',
    'no_receipt',
    'no_receipt_reason',
    'paid_at',
    'payment_method',
    'payment_reference'
  ]) as f(field)
  where v_old -> f.field is distinct from v_new -> f.field;

  -- Like an edit: the lines as they were and as they are, when there's more than one.
  v_lines_after := public.request_lines_summary(p_request_id);
  if v_lines_before is distinct from v_lines_after
     and greatest(jsonb_array_length(v_lines_before), jsonb_array_length(v_lines_after)) > 1 then
    v_changes := coalesce(v_changes, '{}'::jsonb)
      || jsonb_build_object('lines', jsonb_build_object('from', v_lines_before, 'to', v_lines_after));
  end if;

  insert into public.request_events (request_id, actor_id, action, from_status, to_status, note, changes)
  values (p_request_id, auth.uid(), 'corrected', v_after.status, v_after.status, v_reason, v_changes);

  return v_after;
end;
$$;

-- Each request's tags, for reports and the request list. Readable with the
-- request, like the rest of the view.
create or replace view public.request_report
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
  r.payment_reference,
  array(
    select rt.tag_id
    from public.request_tags rt
    where rt.request_id = r.id
    order by rt.tag_id
  ) as tag_ids
from public.reimbursement_requests r
where (select public.has_role('owner'))
  or ((select public.has_role('finance_viewer')) and r.status <> 'draft');
