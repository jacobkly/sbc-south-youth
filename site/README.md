# Site

Public website for SBC South Youth on `sbcsouthyouth.com`, for students, parents, and visitors, plus the invite-only leader portal on `portal.sbcsouthyouth.com`. Built with Next.js (App Router, TypeScript, Tailwind CSS). Heads-ups and events come from Supabase (Postgres), and the portal adds Supabase Auth and Storage, and shadcn/ui.

## Prerequisites

- Node.js 24 or newer
- For heads-ups, events, and the portal: Docker Desktop for the local Supabase stack, or a hosted project's URL and keys

## Setup

```bash
npm install
cp .env.example .env.local   # without these, the public site runs with no heads-ups or events, and forms don't save
npm run dev
```

The public site runs at [http://localhost:3001](http://localhost:3001), so it can run next to the finances app on port 3000. The portal runs at [http://portal.localhost:3001](http://portal.localhost:3001). Browsers send any `*.localhost` name to your own computer, so no hosts file change is needed.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck      # generates Next's route types first, then runs tsc
npm test               # Vitest unit tests (src/**/*.test.ts)
npm run build
```

## Content

- **Page copy and the weekly nights** live in `src/content/`.
- **Heads-ups and events** live in the database's `site` schema. The server reads them with the secret key through `site.public_posts()` and `site.public_events()`, which return only what's live. Pages get them from `src/lib/content/loaders.ts`, which caches them for 5 minutes under the `posts` and `events` tags. Site editors write heads-ups and events in the portal, and each change refreshes the `posts` or `events` tag, so Home, This Week, event pages, and the calendar feed show it on their next load.
- **An event's page** is `/events/<slug>`. The slug follows the title while the event is a draft, and the portal keeps it fixed once the event is published, so shared links keep working. Its short description goes into the page's meta description, after the day, time, and place, for link previews and search results.
- **Without the database,** a build still finishes, and pages show their empty states. Once the site is running, a failed read keeps serving the last good page until the database answers again.
- **A cancelled event** keeps its page, with a banner and the reason, and drops off This Week and Home. Only a published event can be cancelled, and a trigger blocks cancelling a draft, which is deleted instead. Putting a cancelled event back on clears its reason.
- **The calendar feed** (`/calendar.ics`) lists the weekly nights and every event that ended less than 30 days ago or hasn't ended yet. Each event's UID comes from its id (`event-<id>@sbcsouthyouth.com`), and its `SEQUENCE` goes up with every edit, so subscribed calendars update it in place. A cancelled event stays in the feed as `STATUS:CANCELLED`, with "Cancelled:" in its title. The feed is cached for 15 minutes, and an event change refreshes it through the `events` tag.
- **Fake events and heads-ups** come from `supabase/seed.sql`. The seed has no photos, so pages show generated art until you add some in the portal.

## Form messages

The Visit, Join, Serve, and Contact forms check their answers on the page and again in a server action, with the same rules from `src/lib/forms/schemas.ts`. The action (`src/lib/forms/actions.ts`) hands each send to `src/lib/forms/submit.ts`, which runs the steps below and is tested with fakes.

- **Bots:** a hidden honeypot field and a minimum fill time catch simple bots, which get the same "sent" a person does. Cloudflare Turnstile checks everyone else. Its widget (`src/components/forms/turnstile.tsx`) runs out of sight as soon as a form shows and only asks for a click when Cloudflare wants one, and the server checks the token with Cloudflare before saving. When the check fails or never loads, the form says it didn't send and offers the email instead.
- **Saving:** the server calls `site.submit_message()` with the secret key. It checks the fields again, keeps only the ones each form takes, and queues the alert email. A full outbox never stops a message saving. The Contact form's "take down a photo" box, which `/contact?topic=photo-removal` checks, files the message as a takedown.
- **Rate limit:** the server sends an HMAC of the sender's IP address keyed with `FORM_IP_SALT`, never the address. A 6th message in an hour from the same hash is refused with HTTP 429, the form says to try again in an hour, and the hashes are deleted after 24 hours.
- **Alerts:** each message emails `YOUTH_INBOX_EMAIL` with the whole message and a link to it in the portal. Its Reply-To is the sender's email, so a leader can answer from the email, or the email says to call or text when the sender left only a phone number. The server sends it with Next's `after()` once the person has their answer, because the database's nudge only reaches production. With email off, no alert is queued, and the message waits for the daily digest.
- **Daily digest:** a message whose alert never went out, because email was off, the outbox was full, or Resend refused it, keeps `notified_at` empty. Each morning the database pokes the drain with `?digest=1`, and `site.queue_message_digest()` queues one email to the same inbox listing every open message still waiting: takedowns first, then the oldest, up to 20 with a count of the rest. It has no Reply-To, since it's from several people, and each message links to the portal. Each message remembers the digest that listed it, so it's in only one digest that reaches the inbox, and a failed digest lets it into the next. Nothing waiting means no email.
- **Staging:** messages from the staging site still save, marked as staging tests. Their alerts go to `OWNER_ALERT_EMAIL` with no Reply-To, so a test never reaches a real sender, and the Messages screen keeps them under "See staging tests", away from real ones.
- **Reading:** only leaders with the Messages role see the portal's Messages screen. It sorts messages into New, In progress, and Handled, oldest first while open, with photo takedowns above the rest. On a message, a leader picks it up, hands it to another leader, marks it handled or spam, records how a serve message went, and keeps a note only leaders see. Each change shows at once and saves through `site.triage_message()`. The list of leaders comes from `site.message_assignees()`, since the Messages role can't read other people's roles.
- **History:** Activity logs a message's status, who has it, and its outcome, never what the sender or a leader wrote, and only leaders with Messages see those rows. Page titles and Activity name a message by its kind, never by the sender.
- **Keeping:** handled messages are deleted after 12 months and spam after 30 days. Open messages stay until someone handles them.
- **Security headers:** every public page lets Turnstile's script and frame load from `https://challenges.cloudflare.com`, because a link can open a form page without a reload, and the first page's policy stays in force. The portal host never allows it.

To try the forms locally, put Cloudflare's test keys from `.env.example` in `.env.local`, set `FORM_IP_SALT` and `YOUTH_INBOX_EMAIL`, and turn on local email (see below). Alerts then land in Mailpit.

## Photos

Site photos live in Supabase, so site editors can change them from the portal without a deploy. They add, place, and take them down on the portal's Photos screen, and public pages show the change on their next load.

- **Files:** each photo has two files in the public `site-photos` bucket, `<photo id>/lg.webp` and `sm.webp`. Safari can't make WebP, so photos added from an iPhone are `lg.jpg` and `sm.jpg`, and the row's `mime_type` says which. The id is random, so a file name never says who's in a photo. The bucket takes only WebP and JPEG files up to 1 MB. Anyone can load a file by its URL, but only site editors list, add, or delete them. `src/lib/photo-files.ts` builds the paths and URLs for both the portal and the public pages.
- **Records:** `site.photos` holds each photo's alt text, its size in pixels, and where it shows: one named spot on the site, like `home-hero`, or one event's cover. Putting a photo in a spot or on an event sends the one that was there back to the library.
- **Spots:** `src/lib/photo-spots.ts` lists every spot by page, with the label the portal shows and the short name on its badge. The row keeps the spot's code name, so renaming a spot takes its photo off the site. A spot is added there and on the page that shows it, with no migration, and a test fails if no public page shows it. The Photos screen lists every spot still waiting for a photo, by page.
- **Placing:** tapping a photo in the library opens it to change its alt text and where it shows: not on the site, a spot, or the cover of a draft or upcoming event. Saving says which photo it replaces, and clears the `photos` cache tag with `updateTag`, so public pages show the change on their next load.
- **Shrinking:** the portal shrinks each photo on the phone before it uploads: 1600 px on the long side for `lg`, aiming for about 300 KB, and 640 px for `sm`, about 60 KB. Only the quality steps down to fit, never the size. Drawing it on a canvas turns it upright and leaves its EXIF data, like GPS location, behind. A photo under 1000 px on its long side is turned away as too soft.
- **Uploading:** the files go up first and the row after, which checks both files are there, of one type, and records their size and type. If adding the row fails, the portal deletes the files again. A photo's files can't be replaced once it's up, and uploads stop when storage reaches 95% of the free plan's 1 GB, so receipts always have room.
- **Taking down:** `site.remove_photo()` takes a photo off the site and keeps a record of who took it down, when, and why, linked to the takedown request if there was one. The portal deletes its files right after, and the record goes 2 years later. If the files don't delete, `site.photos_with_files_left()` finds them, and the photo shows under Taken down with a button to delete them again.
- **Takedown requests:** a takedown message from the Contact form has a Find the photo button for leaders who are also site editors. It opens the library with the request already picked, so taking the photo down links them. The message then shows the photos that came down for it, so the leader can reply and mark it handled.
- **Reading:** `site.public_photos()` returns only photos in a spot or on a published or cancelled event's page, and only the server's secret key can call it. `getPhotos()` in `src/lib/content/loaders.ts` caches them under the `photos` and `events` tags, since a cover shows only while its event does, and hands pages each spot's photo and each event's cover.
- **Showing:** `src/components/site/photo.tsx` draws a plain `<img>` with both files in its `srcset`, so the browser picks the size it needs straight from Storage, and nothing goes through Next's image optimizer. A spot with no photo shows generated art instead, everywhere, launch included. Link previews draw an event's or Home's photo into the image, but they can only read JPEG, so a WebP photo falls back to the art there.
- **Security headers:** the portal's policy lets images load from the Supabase project, for photos and profile pictures, and from `blob:`, for previews of a picked photo. The public site's allows its own images and the Supabase project, for placed photos. The headers come from `next.config.ts`, so restart `npm run dev` after changing them.

## Launch gate

Until launch, production shows the coming-soon page for every page. Previews and local builds show the full site.

- The gate is decided at build time in `src/lib/launch-gate.ts`: a Vercel build that isn't a preview is gated unless `SITE_LIVE` is `true`.
- The gate never applies to the portal host, so leaders can use the portal before the site launches.
- To launch, set `SITE_LIVE=true` on the site's Vercel project (Production) and redeploy.
- To check the gate locally, build with `VERCEL=1 VERCEL_ENV=production npm run build`, then `npm start`.

## Leader portal

The portal's pages live in `src/app/(portal)/portal/`, with their own root layout, styles, and components. Rewrites in `src/lib/host.ts` serve that folder at the root of any host whose name starts with `portal` and return 404 for it everywhere else. The public site never loads portal code, Supabase, or a sign-in cookie, and an ESLint rule keeps portal imports out of public pages.

Portal changes run in server actions as the signed-in person, so row-level security checks each one. Actions that need a role start with `requireRole()` in `src/lib/portal/auth/require-role.ts`, which refuses anyone without it, and every change on staging, in words the form can show.

### Draft previews

The Preview tab on a heads-up or event shows the draft with the public site's own components and styles, in a frame, so the site's stylesheet never reaches the portal's pages.

- The frame loads `/preview` on the portal host. Its page lives in `src/app/(portal-preview)/portal/preview/`, outside the portal's folders, because the public stylesheet doesn't scan them. The ESLint rule lets this one folder import portal code.
- The editor sends the draft to the frame with `postMessage`, and each side only listens to the other's window on the same origin. The messages are in `src/lib/portal/preview/messages.ts`.
- The frame's server action sits beside its page and renders the draft with `src/lib/portal/preview/preview.ts`. It checks for a site editor, takes only the form's own fields, and never saves anything.
- Portal pages may frame only the portal's own pages (`frame-src 'self'`), only `/preview` lets them (`frame-ancestors 'self'`), and every other page refuses to be framed.

### Email

Everything the apps send goes through `public.email_log`, which is also the outbox. Resend's free plan allows 100 emails a day and 3,000 a month, and `email_reserve()` keeps the last of that room for the emails that matter most.

- **Limits:** counted over the last 24 hours and 31 days, since Resend doesn't say when its own day or month starts. Finance emails and form alerts stop at 80 in a day, invites and owner alerts at 90, and the daily digest at 100. Everything stops at 2,900 in a month, leaving the rest for sign-in codes, which Supabase sends straight to Resend. Emails that were skipped, blocked, or never reached Resend don't count.
- **Email screen:** owners see both limits as meters with what they're holding back, what each kind of email sent with any that bounced, failed, or were skipped, the newest failures, bounces, and spam reports, and the blocked addresses. `public.email_summary()` returns counts only, never an address or a subject, and `src/lib/portal/email/summary.ts` turns them into what the screen says. It mirrors `email_reserve()`'s caps, so change both together.
- **Blocked addresses:** an address that bounced or was marked as spam gets nothing more. An owner can unblock one once it's fixed, which runs `email_unsuppress()` as them.
- **Warnings:** an owner's Home shows a card once either limit passes 80%. Each morning, `public.queue_quota_warning()` emails every owner once the last 31 days pass 2,400, at most once a calendar month in Los Angeles time.

### Errors

Vercel's free plan keeps runtime logs for only a short time, so the server also writes each unexpected error to `public.app_errors`, and owners see the last 30 days on their Home, with repeats folded together.

- **Reporting:** `reportError()` in `src/lib/errors/report.ts` writes an error to the console and the error log once the response has gone. Portal actions use `actionError()` from `src/lib/portal/errors.ts`, which shows the person the same message as before and reports only what isn't a refusal the form already explains. `src/instrumentation.ts` reports whatever a page, route, or action throws, named by its route's pattern, like "Portal page /events/[id]". Turnstile and the email code also report setup problems, like a refused secret or a missing inbox, since every form or digest fails until they're fixed. Redirects, 404s, and emails the email log already marks failed aren't errors.
- **What's kept:** where it happened, one line of message, a code, who hit it, and whether it came from staging. Never a stack, and email addresses and phone numbers come out of the message first. A page error's message is hidden in production, so its code is the digest that matches Vercel's logs.
- **Limits:** only the secret key can write, through `report_error()`, which keeps at most 100 an hour so a loop of failures can't fill the database. Only owners read it, and a nightly job deletes errors after 30 days.

### Run it locally

1. From the repo root, start the local stack with `npx supabase start`, then load the fake data with `npx supabase db reset`.
2. Fill in `.env.local` with the API URL, publishable key, and secret key from `npx supabase status`.
3. Run `npm run dev` and open [http://portal.localhost:3001](http://portal.localhost:3001). The header of `supabase/seed.sql` lists the fake people and their password.

For local email, set `EMAIL_FROM` and `EMAIL_LOCAL_INBOX=http://127.0.0.1:54324`. Emails then land in Mailpit at [http://localhost:54324](http://localhost:54324) instead of going through Resend. Set `EMAIL_DRAIN_SECRET` to the `email_drain_secret` in the seed, so the local database can ask the portal to send what it queues.

### Endpoints

| Path (portal host) | What calls it |
| --- | --- |
| `/api/email/drain` | The database, through `pg_net`, when a change queues an email, and once each morning with `?digest=1`, which also queues the form inbox's daily digest. It needs `Authorization: Bearer <EMAIL_DRAIN_SECRET>` |
| `/api/webhooks/resend` | Resend, with delivery, bounce, and complaint updates. It checks the signature with `RESEND_WEBHOOK_SECRET` |
| `/auth/callback` | Sign-in links in Supabase's own emails, if a template uses one |
| `/activity/export` | An owner's Download button on Activity |
| `/preview` | The Preview tab's frame on a heads-up or event. Only portal pages can frame it |

### Staging

Vercel previews of the `dev` branch are staging. Staging shares production's data, so the portal shows a banner, refuses every change, and sends each email to `OWNER_ALERT_EMAIL` instead of the real recipient. The public forms still save, marked as staging tests.

## Environment variables

The public site needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` for heads-ups, events, and form messages, and the Turnstile keys and `FORM_IP_SALT` for the forms to save. Without them it still builds, with no heads-ups or events showing, generated art in place of photos, and forms that point people to the email instead. Pages show a placeholder when any other one is missing. `.env.example` explains each variable in more detail.

| Variable | Used for |
| --- | --- |
| `SITE_LIVE` | `true` opens the launch gate (read at build time) |
| `GIVE_CASHTAG` | The Cash App cashtag on the Give page, like `$ExampleYouth`. Without it, Give shows a "coming soon" card and the Give buttons stay hidden |
| `CHURCH_TEXT_NUMBER` | A church-owned number that takes texts, for "let us know you're coming". Never a leader's personal cell |
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project's URL (heads-ups, events, photos, and the portal) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The publishable key. Safe in the browser, since row-level security decides access |
| `NEXT_PUBLIC_AUTH_COOKIE_NAME`, `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` | The sign-in cookie's name and domain. Leave both empty to keep it on the portal's own host |
| `APP_ENV` | `production` or `staging`. Empty means production, except on Vercel previews, which are staging |
| `FINANCES_URL`, `PORTAL_URL` | Where the portal links to finances and to itself. Default to the real addresses |
| `SUPABASE_SECRET_KEY` | Server only. Reads the site's heads-ups, events, and photos, saves form messages, calls the email functions, writes the error log, and creates, bans, and unbans invited accounts. Never a `NEXT_PUBLIC_` variable |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sending email. Without both, email is off |
| `OWNER_ALERT_EMAIL` | Owner alerts, and every email on staging, form alerts included |
| `RESEND_WEBHOOK_SECRET` | Checks that webhook calls came from Resend |
| `EMAIL_DRAIN_SECRET` | Checks that drain calls came from the database. Must match `email_drain_secret` in Supabase Vault |
| `EMAIL_LOCAL_INBOX` | Local only: send email to Mailpit instead of Resend |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile on the forms. The secret is server only, and production refuses Cloudflare's test secret |
| `FORM_IP_SALT` | Keys the hash of each sender's address for the forms' hourly limit. At least 32 random characters |
| `YOUTH_INBOX_EMAIL` | Gets an email for each form message, with Reply-To set to the sender |
