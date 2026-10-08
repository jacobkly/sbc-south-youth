-- A role for the leader who counts how many come to youth each week.
--
-- It's added on its own, since a new enum value can't be used until the
-- migration that adds it commits. The next migration gives it its table and
-- rules. It sorts after site_messages, so stored role lists keep their order.

alter type public.app_role add value 'attendance';

comment on type public.app_role is
  'owner: everything in both apps, and the only role that invites people, changes roles, removes access, and approves or pays. '
  'finance_viewer: reads every submitted request, receipt, and report, and changes nothing. '
  'finance_requester: submits their own reimbursements and sees only their own requests. '
  'site_editor: posts heads-ups and events, and uploads, places, and takes down photos. '
  'site_messages: reads and handles the site''s form messages. '
  'attendance: enters and fixes how many came to youth each week.';
