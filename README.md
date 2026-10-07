# SBC South Youth

Web projects for SBC South Youth. This repo holds every app under the `sbcsouthyouth.com` domain. Each app lives in its own folder and deploys on its own.

## Apps

| Folder | What it is | Status |
|---|---|---|
| [`finances/`](finances/) | Invite-only app for tracking reimbursements, receipts, and expense reports for the youth ministry (`finances.` subdomain) | In use |
| [`site/`](site/) | Public youth website (about, events, photos, contact) on the main domain, plus the leader portal (`portal.` subdomain) | Coming-soon page in production; portal in development |
| [`supabase/`](supabase/) | The database, auth, and file storage both apps share | |

## Finances app

Members who buy supplies for the youth cafe or youth events get paid back by the ministry. The finances app keeps a record of each reimbursement: who was paid, what it was for, the receipts, and its approval and payment status. It also produces monthly, quarterly, and yearly reports and CSV exports.

The app only keeps records. It never moves money.

**Stack:** Next.js (TypeScript, App Router, Tailwind CSS), Supabase (Postgres, Auth, Storage), hosted on Vercel.

See [`finances/README.md`](finances/README.md) for local setup.

## Site and leader portal

The public site is for students, parents, and visitors, with no logins. Its heads-ups, events, and photos come from the database, and its Visit, Join, Serve, and Contact forms email the youth inbox.

The leader portal is where leaders run the site from a phone. It's invite-only, lives in the site app on `portal.sbcsouthyouth.com`, and can be added to a phone's home screen. Leaders use it to:

- invite people and set their roles
- post heads-ups and events, and add photos
- follow up on form messages
- see recent activity, email and storage use, and the last backup

Once one sign-in is turned on (see [Deployment](#deployment)), people sign in once on the portal and switch between it and finances from the navigation.

See [`site/README.md`](site/README.md) for how it works and for local setup.

### Roles

Each person can hold several roles. Owner counts as all of them.

| Role | Can do |
| --- | --- |
| Owner | Everything in both apps. The only role that invites people, changes roles, removes access, and approves or pays reimbursements. Uses two-step sign-in |
| Finance viewer | Read every submitted request, receipt, and report in finances. Change nothing |
| Requester | Submit their own reimbursements in finances and see only their own requests |
| Site editor | Post heads-ups and events, and add, place, and take down photos |
| Messages | Read and handle messages from the site's forms |

The database enforces every role with row-level security, so hiding a button is never what keeps someone out.

## Database

Both apps use one Supabase project, kept in [`supabase/`](supabase/): migrations, config, email templates, the database tests, and fake seed data. The Supabase CLI is installed at the repo root, so run these from here:

```bash
npm install                                  # installs the Supabase CLI
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run               # list migrations the hosted project doesn't have yet
npx supabase db push                         # apply them, in order
npm run db:types                             # regenerate the finances app's database types
```

Migrations can land on `dev` or `main`. Push them from the `dev` checkout after it has merged `main`, and before pushing any code that needs them.

The site's heads-ups, events, form messages, and photo records live in a separate `site` schema, and photo files in the public `site-photos` bucket. `[api] schemas` in `supabase/config.toml` exposes it locally. On the hosted project, add `site` under Project Settings → Data API → Exposed schemas too. Anyone without the Site editor role still reads nothing there, and the public site reads only what's live, through functions only the server's secret key can call.

### Local stack

With Docker Desktop, run the whole backend on your computer:

```bash
npx supabase start                    # start it; `npx supabase status` prints the URL and keys
npx supabase db reset                 # rebuild it from the migrations and supabase/seed.sql
npx supabase migration up --local     # apply new migrations without wiping the data
npx supabase test db                  # run the database tests in supabase/tests
npm run db:types:local                # finances types from the local stack
npm run db:types:site                 # the site's types (public and site schemas)
```

The seed adds fake people for each kind of access. Its header comment lists them with the local password. Emails sent locally land in Mailpit at http://localhost:54324.

### Scheduled jobs and secrets

`pg_cron` runs these inside the database:

| Job | When (UTC) | What it does |
| --- | --- | --- |
| `email-quota-warning` | 14:55 | Emails owners once a month when the last 31 days pass 2,400 of Resend's 3,000 emails |
| `email-daily-digest` | 15:00 | Asks the portal to send anything still in the email queue, and to send the form inbox one email listing the messages whose alerts never went |
| `prune-old-activity` | 10:00 | Deletes site and people activity older than two years. Finance history stays |
| `clear-old-email-addresses` | 10:05 | Clears recipient addresses from the email log after 90 days |
| `prune-cron-history` | 10:10 | Deletes `pg_cron`'s own run history after 14 days |
| `prune-messages` | 10:15 | Deletes form messages 12 months after they were handled, and spam after 30 days. Open messages stay |
| `prune-form-rate-limits` | 10:20 | Deletes the forms' rate-limit rows after 24 hours |
| `prune-removed-photos` | 10:25 | Deletes the record of a taken-down photo 2 years after it came down |
| `prune-app-errors` | 10:30 | Deletes errors from the owners' error log after 30 days |

When a change queues an email, the database asks the portal to send it right away through `pg_net`. That needs three Vault secrets on the hosted project: `email_drain_url` (`https://portal.sbcsouthyouth.com/api/email/drain`), `email_drain_secret` (the same value as the site's `EMAIL_DRAIN_SECRET`), and, only when the URL can't name the portal host, `email_drain_host`. Without them, emails wait in the queue.

### Backups

A nightly backup job runs outside this repo. It signs in as the `backup_job` database role, which can read every row but write nothing, dumps the database, copies the stored files, and then reports the sizes with `select public.record_backup(<dump bytes>, <file bytes>, <file count>);`. The owner's portal Home shows the last one and turns amber after 48 hours.

The role can't sign in until it has a password. Set it in the SQL editor, never in a migration:

```sql
alter role backup_job with login password '<a long random password>';
```

### GitHub Actions

- [`db.yml`](.github/workflows/db.yml) runs the database tests on a fresh local stack whenever `supabase/` changes.
- [`keep-alive.yml`](.github/workflows/keep-alive.yml) pings the database daily so the free project doesn't pause. It needs the `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` repository secrets.

## Deployment

Each app is its own Vercel project connected to this repo, with its **Root Directory** set to the app's folder and builds skipped when that folder hasn't changed.

- `main` is production. The site project serves both `sbcsouthyouth.com` and `portal.sbcsouthyouth.com`.
- `dev` deploys to `staging.sbcsouthyouth.com`, behind Vercel Authentication. Staging shares production's data, so its portal is read-only and sends email only to the owner alert address. Its forms still save, marked as staging tests.
- The staging portal is another domain on the site project, assigned to `dev`, whose name starts with `portal-`, like `portal-staging.sbcsouthyouth.com`. The site treats any host named like that as a portal, and links it to `staging.sbcsouthyouth.com`.
- Site changes go to `dev` first. Finances changes go to `main`, and `dev` merges `main` afterward.
- One sign-in for both apps needs `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=sbcsouthyouth.com` in Production on both Vercel projects, then a redeploy of both. Leave it unset on Preview, so staging keeps its own sign-in. The cookie then reaches every `sbcsouthyouth.com` host, so the public site keeps its outside scripts to Turnstile alone.
- The site's forms need a Cloudflare Turnstile widget with `sbcsouthyouth.com` and `staging.sbcsouthyouth.com` as its hostnames. Its site key and secret go on the site's Vercel project, with `FORM_IP_SALT` and `YOUTH_INBOX_EMAIL`.

## License

[MIT](LICENSE)
