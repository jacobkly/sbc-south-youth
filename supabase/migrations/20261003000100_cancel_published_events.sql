-- Only an event that went out can be cancelled. A draft nobody saw is
-- deleted instead, since cancelling it would put an event no one heard of
-- into calendars just to call it off.
--
-- Bringing a cancelled event back is still allowed, for one called off by
-- mistake or back on after all.

create or replace function site.keep_published()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' and new.status = 'draft' then
    raise exception 'An event that''s been published can''t go back to a draft.' using errcode = '55000';
  end if;
  if old.status = 'draft' and new.status = 'cancelled' then
    raise exception 'Only a published event can be cancelled. Delete the draft instead.' using errcode = '55000';
  end if;
  return new;
end;
$$;

comment on function site.keep_published() is
  'Keeps an event''s status moving forward: drafts publish, published events cancel, and nothing goes back to a draft.';

revoke execute on function site.keep_published() from public, anon, authenticated;
