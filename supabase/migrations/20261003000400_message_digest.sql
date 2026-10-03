-- The daily digest. A message whose alert never went out, because the
-- outbox was full, Resend refused it, or email was off, keeps notified_at
-- empty. Each morning the database pokes the drain with digest=1, and the
-- drain asks site.queue_message_digest() to queue one email listing them,
-- to the same inbox the alerts go to. Each message remembers the digest
-- that listed it, so it goes in only one that reaches the inbox.

alter table site.messages
  add column digest_id uuid references public.email_log (id) on delete set null;

comment on column site.messages.digest_id is
  'The daily digest that listed this message, set by site.queue_message_digest(). A failed digest lets it into the next.';

create index messages_digest_id_idx on site.messages (digest_id) where digest_id is not null;

-- Queues the daily digest for one environment and returns how many messages
-- it lists. It lists open messages with no alert sent and none on its way,
-- that no other digest has listed unless that one failed. It returns 0 and
-- queues nothing when none are waiting, and 0 when the quota or the
-- once-a-day rule skips it, which leaves them for the next one.
create function site.queue_message_digest(p_env text, p_to text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_count integer;
  v_log public.email_log;
begin
  if p_env is null or p_env not in ('production', 'staging') then
    raise exception 'A digest is for production or staging.' using errcode = '22023';
  end if;

  if nullif(btrim(p_to), '') is null then
    raise exception 'The digest needs an address.' using errcode = '22023';
  end if;

  -- One digest at a time, so two can't list the same messages.
  perform pg_advisory_xact_lock(hashtext('site.queue_message_digest'));

  select coalesce(array_agg(m.id), '{}')
  into v_ids
  from site.messages m
  where m.env = p_env
    and m.notified_at is null
    and m.status in ('new', 'in_progress')
    and not exists (
      select 1 from public.email_log l
      where l.template = 'form-alert'
        and l.related_type = 'message'
        and l.related_id = m.id
        and l.status in ('queued', 'sending')
    )
    and (
      m.digest_id is null
      or exists (select 1 from public.email_log d where d.id = m.digest_id and d.status = 'failed')
    );

  v_count := cardinality(v_ids);
  if v_count = 0 then
    return 0;
  end if;

  -- Only the count goes in the subject, which inboxes show before anyone opens it.
  v_log := public.email_reserve(
    'daily-digest',
    5,
    p_to,
    v_count || case when v_count = 1 then ' message from the website is waiting'
      else ' messages from the website are waiting' end,
    'site',
    p_env
  );

  if v_log.status <> 'queued' then
    return 0;
  end if;

  update site.messages set digest_id = v_log.id where id = any (v_ids);

  return v_count;
end;
$$;

revoke execute on function site.queue_message_digest(text, text) from public, anon, authenticated;
grant execute on function site.queue_message_digest(text, text) to service_role;

-- Marks a message notified once Resend takes its alert, or the digest that
-- listed it. A failed alert leaves it for the daily digest.
create or replace function site.mark_message_notified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.template = 'form-alert' then
    update site.messages
    set notified_at = coalesce(new.sent_at, now())
    where id = new.related_id and notified_at is null;
  else
    update site.messages
    set notified_at = coalesce(new.sent_at, now())
    where digest_id = new.id and notified_at is null;
  end if;
  return null;
end;
$$;

drop trigger mark_message_notified on public.email_log;

create trigger mark_message_notified
  after update of status on public.email_log
  for each row
  when (
    ((new.template = 'form-alert' and new.related_type = 'message') or new.template = 'daily-digest')
    and new.resend_id is not null
    and new.status in ('sent', 'delivered')
  )
  execute function site.mark_message_notified();

-- The digest's details: what it lists, takedowns first and then the oldest,
-- up to 20, and how many in all. Everything else is unchanged.
create or replace function public.email_details(p_log_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_log public.email_log;
  v_action text;
  v_details jsonb;
begin
  select * into v_log
  from public.email_log
  where id = p_log_id
    and status = 'sending';

  if not found then
    return null;
  end if;

  -- A digest is about the messages that point at it, not one row of its own.
  if v_log.template = 'daily-digest' then
    select jsonb_build_object(
      'env', v_log.env,
      'total', count(*),
      'messages', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', d.id,
            'kind', d.kind,
            'name', d.name,
            'email', d.email,
            'phone', d.phone,
            'message', d.message,
            'details', d.details,
            'created_at', d.created_at
          )
          order by d.n
        ) filter (where d.n <= 20),
        '[]'
      )
    )
    into v_details
    from (
      select m.*, row_number() over (order by m.kind = 'takedown' desc, m.created_at, m.id) as n
      from site.messages m
      where m.digest_id = v_log.id
    ) d;

    -- Every message it listed is gone, so there's nothing to send.
    if (v_details ->> 'total')::integer = 0 then
      return null;
    end if;

    return v_details;
  end if;

  if v_log.related_id is null then
    return null;
  end if;

  if v_log.related_type = 'reimbursement_request' then
    v_action := case v_log.template
      when 'request-submitted' then 'submitted'
      when 'request-returned' then 'info_requested'
      when 'request-paid' then 'paid'
    end;

    if v_action is null then
      return null;
    end if;

    -- "by" is whoever made the change that queued the email: the step it
    -- logged at or before the email, since both happen in one transaction.
    select jsonb_build_object(
      'number', 'R-' || lpad(r.request_number::text, 4, '0'),
      'amount_cents', r.amount_cents,
      'vendor', r.vendor,
      'by', e.full_name,
      'payee', case when v_action = 'submitted' then p.full_name end,
      -- Whether they asked for their own money, since the payee's name can differ from their account's.
      'by_payee', case when v_action = 'submitted' then coalesce(e.actor_id = p.user_id, false) end,
      'description', case when v_action = 'submitted' then left(r.description, 200) end,
      'note', case when v_action = 'info_requested' then coalesce(e.note, r.admin_note) end,
      'payment_method', case when v_action = 'paid' then r.payment_method end,
      'paid_at', case when v_action = 'paid' then r.paid_at end
    )
    into v_details
    from public.reimbursement_requests r
    join public.payees p on p.id = r.payee_id
    left join lateral (
      select ev.note, ev.actor_id, u.full_name
      from public.request_events ev
      left join public.users u on u.id = ev.actor_id
      where ev.request_id = r.id
        and ev.action = v_action
        and ev.created_at <= v_log.created_at
      order by ev.created_at desc, ev.id desc
      limit 1
    ) e on true
    where r.id = v_log.related_id;

    return v_details;
  end if;

  if v_log.related_type = 'user' and v_log.template = 'owner-changed' then
    select jsonb_build_object('name', u.full_name, 'by', a.full_name)
    into v_details
    from public.users u
    left join lateral (
      select actor.full_name
      from public.activity_log l
      left join public.users actor on actor.id = l.actor_id
      where l.entity_type = 'user'
        and l.entity_id = u.id::text
        and l.created_at <= v_log.created_at
      order by l.created_at desc, l.id desc
      limit 1
    ) a on true
    where u.id = v_log.related_id;

    return v_details;
  end if;

  -- A form alert shows the whole message, so a leader can answer it from the
  -- email. Its Reply-To is the sender's email.
  if v_log.related_type = 'message' and v_log.template = 'form-alert' then
    select jsonb_build_object(
      'kind', m.kind,
      'name', m.name,
      'email', m.email,
      'phone', m.phone,
      'message', m.message,
      'details', m.details,
      'env', m.env
    )
    into v_details
    from site.messages m
    where m.id = v_log.related_id;

    return v_details;
  end if;

  return null;
end;
$$;

revoke execute on function public.email_details(uuid) from public, anon, authenticated;
grant execute on function public.email_details(uuid) to service_role;
