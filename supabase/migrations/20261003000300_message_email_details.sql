-- Form alerts. The drain reads a form message through email_details() while
-- it sends that message's alert, the same way it reads a request or an owner
-- change, and only then. Everything else is unchanged.

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

  if not found or v_log.related_id is null then
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
