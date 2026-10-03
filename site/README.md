# Site

Public website for SBC South Youth on `sbcsouthyouth.com`, for students, parents, and visitors, plus the invite-only leader portal on `portal.sbcsouthyouth.com`. Built with Next.js (App Router, TypeScript, Tailwind CSS). The portal adds Supabase (Postgres, Auth, Storage) and shadcn/ui.

## Prerequisites

- Node.js 24 or newer
- For the portal: Docker Desktop for the local Supabase stack, or a hosted project's URL and keys

## Setup

```bash
npm install
cp .env.example .env.local   # only the portal needs these; the public site runs without them
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

## Launch gate

Until launch, production shows the coming-soon page for every page. Previews and local builds show the full site.

- The gate is decided at build time in `src/lib/launch-gate.ts`: a Vercel build that isn't a preview is gated unless `SITE_LIVE` is `true`.
- The gate never applies to the portal host, so leaders can use the portal before the site launches.
- To launch, set `SITE_LIVE=true` on the site's Vercel project (Production) and redeploy.
- To check the gate locally, build with `VERCEL=1 VERCEL_ENV=production npm run build`, then `npm start`.

## Leader portal

The portal's pages live in `src/app/(portal)/portal/`, with their own root layout, styles, and components. Rewrites in `src/lib/host.ts` serve that folder at the root of any host whose name starts with `portal` and return 404 for it everywhere else. The public site never loads portal code, Supabase, or a sign-in cookie, and an ESLint rule keeps portal imports out of public pages.

### Run it locally

1. From the repo root, start the local stack with `npx supabase start`, then load the fake data with `npx supabase db reset`.
2. Fill in `.env.local` with the API URL, publishable key, and secret key from `npx supabase status`.
3. Run `npm run dev` and open [http://portal.localhost:3001](http://portal.localhost:3001). The header of `supabase/seed.sql` lists the fake people and their password.

For local email, set `EMAIL_FROM` and `EMAIL_LOCAL_INBOX=http://127.0.0.1:54324`. Emails then land in Mailpit at [http://localhost:54324](http://localhost:54324) instead of going through Resend. Set `EMAIL_DRAIN_SECRET` to the `email_drain_secret` in the seed, so the local database can ask the portal to send what it queues.

### Endpoints

| Path (portal host) | What calls it |
| --- | --- |
| `/api/email/drain` | The database, through `pg_net`, when a change queues an email, and once each morning. It needs `Authorization: Bearer <EMAIL_DRAIN_SECRET>` |
| `/api/webhooks/resend` | Resend, with delivery, bounce, and complaint updates. It checks the signature with `RESEND_WEBHOOK_SECRET` |
| `/auth/callback` | Sign-in links in Supabase's own emails, if a template uses one |
| `/activity/export` | An owner's Download button on Activity |

### Staging

Vercel previews of the `dev` branch are staging. Staging shares production's data, so the portal shows a banner, refuses every change, and sends each email to `OWNER_ALERT_EMAIL` instead of the real recipient.

## Environment variables

The public site needs none of these until launch, and pages show a placeholder when one is missing. `.env.example` explains each portal variable in more detail.

| Variable | Used for |
| --- | --- |
| `SITE_LIVE` | `true` opens the launch gate (read at build time) |
| `GIVE_CASHTAG` | The Cash App cashtag on the Give page, like `$ExampleYouth`. Without it, Give shows a "coming soon" card and the Give buttons stay hidden |
| `CHURCH_TEXT_NUMBER` | A church-owned number that takes texts, for "let us know you're coming". Never a leader's personal cell |
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project's URL (portal) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The publishable key. Safe in the browser, since row-level security decides access |
| `NEXT_PUBLIC_AUTH_COOKIE_NAME`, `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` | The sign-in cookie's name and domain. Leave both empty to keep it on the portal's own host |
| `APP_ENV` | `production` or `staging`. Empty means production, except on Vercel previews, which are staging |
| `FINANCES_URL`, `PORTAL_URL` | Where the portal links to finances and to itself. Default to the real addresses |
| `SUPABASE_SECRET_KEY` | Server only. Calls the email functions and creates, bans, and unbans invited accounts. Never a `NEXT_PUBLIC_` variable |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sending email. Without both, email is off |
| `OWNER_ALERT_EMAIL` | Owner alerts, and every email on staging |
| `RESEND_WEBHOOK_SECRET` | Checks that webhook calls came from Resend |
| `EMAIL_DRAIN_SECRET` | Checks that drain calls came from the database. Must match `email_drain_secret` in Supabase Vault |
| `EMAIL_LOCAL_INBOX` | Local only: send email to Mailpit instead of Resend |
