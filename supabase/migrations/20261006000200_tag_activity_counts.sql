-- Renaming or deleting a tag logs one row that says how many requests it was
-- on, rather than leaving each request's history to say so. And a name that's
-- taken says which tag has it, as it's spelled, not as it was typed.

create or replace function public.guard_tag()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_taken text;
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));

  if new.name = '' then
    raise exception 'Enter a name.' using errcode = '22023';
  end if;

  if char_length(new.name) > 50 then
    raise exception 'Keep the name to 50 characters or fewer.' using errcode = '22001';
  end if;

  select t.name into v_taken
  from public.tags t
  where lower(t.name) = lower(new.name) and t.id <> new.id;

  if found then
    raise exception 'There''s already a tag called %.', v_taken using errcode = '23505';
  end if;

  return new;
end;
$$;

-- Logs making, renaming, and deleting a tag, like log_activity() does, and
-- adds how many requests a renamed or deleted tag is on, drafts included.
-- Deleting counts before the delete takes the tag off its requests, so that
-- trigger runs before the delete.
create function public.log_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_changes jsonb;
begin
  if tg_op = 'UPDATE' and new.name = old.name then
    return null;
  end if;

  if tg_op <> 'INSERT' then
    select count(*) into v_count
    from public.request_tags rt
    where rt.tag_id = old.id;
  end if;

  if tg_op = 'INSERT' then
    v_changes := jsonb_build_object('name', jsonb_build_object('from', null, 'to', new.name));
  elsif tg_op = 'UPDATE' then
    v_changes := jsonb_build_object(
      'name', jsonb_build_object('from', old.name, 'to', new.name),
      'requests', jsonb_build_object('from', v_count, 'to', v_count)
    );
  else
    v_changes := jsonb_build_object(
      'name', jsonb_build_object('from', old.name, 'to', null),
      'requests', jsonb_build_object('from', v_count, 'to', 0)
    );
  end if;

  insert into public.activity_log (actor_id, scope, action, entity_type, entity_id, entity_name, changes)
  values (
    coalesce(auth.uid(), case when tg_op = 'INSERT' then new.created_by end),
    'finances',
    'tag.' || case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    'tag',
    case when tg_op = 'DELETE' then old.id else new.id end::text,
    case when tg_op = 'DELETE' then old.name else new.name end,
    v_changes
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return null;
end;
$$;

revoke execute on function public.log_tag() from public, anon, authenticated;

drop trigger log_activity on public.tags;

create trigger log_activity
  after insert or update of name on public.tags
  for each row execute function public.log_tag();

create trigger log_tag_deleted
  before delete on public.tags
  for each row execute function public.log_tag();
