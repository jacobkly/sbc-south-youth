-- The activity page lists every request's events, newest first. The other
-- indexes are per request and per person, so without this each page would
-- sort the whole log.

create index request_events_created_at_idx
  on public.request_events (created_at desc, id desc);
