-- A short note on a night that wasn't like the others, like a holiday, and
-- a mark for a combined event, when another group joined youth that night.
-- The portal leaves combined nights out of the average and the most, so one
-- big night doesn't skew them.

alter table public.headcounts
  add column note text
    check (note is null or (note = btrim(note) and char_length(note) between 1 and 200)),
  add column combined boolean not null default false;

comment on column public.headcounts.note is 'What was different about the night, like a holiday.';
comment on column public.headcounts.combined is
  'Another group joined youth that night, so it''s left out of the average and the most.';

grant insert (note, combined) on table public.headcounts to authenticated;
grant update (note, combined) on table public.headcounts to authenticated;

-- Names the last editor when only the note or the mark changes, too.
drop trigger guard_headcount on public.headcounts;

create trigger guard_headcount
  before insert or update of night, total, note, combined on public.headcounts
  for each row execute function public.guard_headcount();

drop trigger log_activity on public.headcounts;

create trigger log_activity
  after insert or update or delete on public.headcounts
  for each row execute function public.log_activity('site', 'headcount', 'night', 'night', 'total', 'note', 'combined');
