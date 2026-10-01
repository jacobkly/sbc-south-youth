# CLAUDE.md

Guidance for Claude Code in this repo.

## Project

Monorepo for SBC South Youth web projects on `sbcsouthyouth.com`. Each app is its own folder and its own Vercel project.

- `finances/`: invite-only reimbursement tracker (`finances.` subdomain). Next.js 16 (App Router, TypeScript strict, Tailwind v4) and Supabase (Postgres, Auth, Storage). In maintenance.
- `site/`: public youth website on the apex domain, for students, parents, and visitors, with no logins. Next.js 16 (App Router, TypeScript strict, Tailwind v4).
- The **leader portal** (`portal.` subdomain) lives inside the `site/` app, under `site/src/app/(portal)`. It's invite-only and phone-first. It manages people and roles for both apps, shows activity and free-tier usage, and moves weekly site content, photos, and form messages out of code. Finance data reaches it only for owners and finance viewers, through RLS. **Active.**
- `supabase/`: the Supabase project both apps share: migrations, config, and email templates.

## Current focus

- **The portal is the active work.** First people and roles, then requester self-service and read-only viewers in finances, then site content, the form inbox, and photos.
- **The public site** keeps fake content and hotlinked placeholder photos until the portal replaces them. Forms validate but don't save or send yet (`TODO(wire-up)`). Wiring them to Supabase, email, and bot protection comes with the portal. The site doesn't launch until real photos fill every spot.
- **Finances** gets bug fixes, small features, and the requester and viewer screens. Receipts live in Supabase Storage, compressed in the browser to fit the 1 GB free tier.

## Commands

Run these from `finances/`:

```bash
npm run dev            # dev server at http://localhost:3000
npm run lint
npm run typecheck
npm test               # Vitest unit tests (src/**/*.test.ts)
npm run build
```

`site/` has the same scripts, and its dev server runs at http://localhost:3001.

Run these from the repo root, where the Supabase CLI is installed:

```bash
npx supabase db push --dry-run  # list migrations the linked project doesn't have yet
npx supabase db push            # apply them
npm run db:types                # regenerate finances/src/lib/database.types.ts
npx supabase start              # local Supabase stack (needs Docker Desktop)
npx supabase db reset           # rebuild local DB from migrations and seed
npx supabase test db            # pgTAP tests in supabase/tests
```

The maintainer runs `link` and `db push` against the hosted project. Claude doesn't handle the database password.

## Rules

### Public repo

- Never commit secrets, keys, `.env.local`, real names, emails, payment handles, receipts, or financial records.
- Seed data and tests use obviously fake people and amounts.

### Security model (no custom backend)

- The browser talks directly to Supabase. **RLS is the security model.** Every table has RLS enabled and denies by default. Hiding UI is never the protection.
- Business rules live in Postgres: status changes only go through RPC functions, constraints and triggers block invalid data, and triggers write the audit log.
- `security definer` functions must `SET search_path = ''` and fully qualify every name.
- Check roles with `public.has_role(...)`, which reads `public.users.roles` and also requires the person to be active. `current_app_role()` is a compatibility wrapper for older finance rules. Never read roles from `user_metadata`.
- `anon` gets no access to anything. The one exception is the public `site-photos` bucket, so published photos load by URL.
- Site content tables and functions (posts, events, photos, messages) live in the `site` schema. Shared platform tables (invites, activity, email log, app errors) live in `public`, next to `public.users`.
- The service role key never goes in the frontend or any `NEXT_PUBLIC_` variable.

### Roles

Roles are a fixed Postgres enum, `public.app_role`, and each person's roles are a list on their row in `public.users.roles`. Roles stack, and `owner` counts as every role. New kinds of access mean a new enum value plus its rules, never a roles table.

| Role | Shown as | Can do |
| --- | --- | --- |
| `owner` | Owner | Everything in both apps. The only role that invites people, changes roles, removes access, and approves or pays reimbursements. Uses two-step sign-in |
| `finance_viewer` | Finance viewer | Read every submitted request, receipt, and report in finances. Change nothing, and never see drafts |
| `finance_requester` | Requester | In finances only: submit their own reimbursements with receipt photos and see only their own requests |
| `site_editor` | Site editor | Post heads-ups and events, and upload, place, and take down photos |
| `site_messages` | Messages | Read and handle Visit, Join, Serve, and Contact messages |

- Only owners change roles, through the `set_roles()` RPC. The database always keeps at least one active owner, and removing access keeps the roles so it can be undone.
- Nobody under 18 gets an account.
- Everyone signs in with email and password. Forgot password and first-time setup use a 6-digit emailed code. No magic links or social sign-in.

### Database

- All schema changes go in Supabase CLI migrations in `supabase/migrations`. No dashboard-only changes.
- `uuid` PKs (`gen_random_uuid()`), `timestamptz`, and `created_at`/`updated_at` with an `updated_at` trigger.
- Money is stored as integer cents and displayed as USD.
- All period math (month, quarter, year, "future date") uses `America/Los_Angeles`.
- Migrations can land on `dev` or `main`. Finances code that needs a migration ships with it on `main`, and `dev` merges `main` afterward. A new migration's timestamp always comes after the newest one on either branch. The maintainer runs `db push` from `dev` after it has merged `main`, before pushing code that depends on it.

### Frontend

- Next.js 16 has breaking changes from older versions. Check `finances/node_modules/next/dist/docs/` before using an API you're unsure of (see `finances/AGENTS.md`).
- The finances app stays out of search engines: `robots.txt` disallows everything and metadata sets `noindex, nofollow`.
- **Mobile-first.** The main user is on an iPhone, so design and check every screen at phone width in iOS Safari first. Desktop must work, but desktop-optimized layouts come later.
- In finances and the portal, use shadcn/ui components for dialogs, pickers, tabs, and menus instead of hand-rolling them (`src/components/ui` in finances, `src/components/portal/ui` in the site app).
- The portal mirrors finances: the same components, tokens, nav, and iPhone rules. Copy code from `finances/`, never import across apps.
- Accessible, with loading, empty, and error states on every screen.

### Public site (`site/`)

- **Design-led, not a productivity tool.** Dark-first "night service poster" look: near-black, big display type, real photos, and one bright accent. Design tokens live in `site/src/app/globals.css`. Check every screen at 375 px and 1280 px, in dark and light.
- No shadcn or Radix on the public site. Use styled native form controls (native `<select>` gives the iOS picker) and native `<dialog>`. Portal code stays under `app/(portal)`, `components/portal`, and `lib/portal`, and an ESLint rule keeps it out of public pages.
- Server Components by default. Client Components only for interactive islands. Animate with CSS transitions and keyframes (no animation library), only `transform`, `translate`, `scale`, and `opacity`, and every animation respects reduced motion. Home JS stays under 150 KB gzipped, and the framework alone is about 135 KB.
- Page copy lives in `site/src/content/`. Anything leadership must approve (times, address, bios, safety policy, giving wording) is a placeholder marked `TODO(leadership)`. Never invent facts about the church, its people, or its policies.
- Minors' privacy: never commit photos of students, and never show a student's last name, school, contact details, or social handle. Never render a group chat invite link.
- Placeholder photos are hotlinked, never committed. Every one is replaced before launch.
- **Launch gate:** a Vercel production build serves `/coming-soon` for every page until `SITE_LIVE=true` is set on the site's Vercel project. Never remove or bypass the gate without the maintainer. The gate skips only the portal host.
- **Staging:** the `dev` branch deploys to `staging.sbcsouthyouth.com`, a Vercel preview behind Vercel Authentication that always shows the full site. Before launch, the maintainer pushes `main` to both branches. After launch, site changes go to `dev` first and reach `main` once they're checked on staging.
- The Supabase secret key is only for the site's server, in `server-only` modules. It may only call functions that `service_role` alone can execute, and never reads tables. The only other calls are three Auth admin calls (create an invited account, ban a removed one, unban a reinstated one), each from a server action that first checks the caller is an owner.
- Public pages read posts, events, and photos only through `site.public_*()` functions that only `service_role` can execute. Every other portal write runs as the signed-in person, so RLS applies.

### Git

- Claude may commit. **Claude never pushes.** The maintainer pushes.
- No `Co-authored-by` trailers and no "Generated with Claude Code" lines.
- Subject line follows Conventional Commits: `<type>(<scope>): <subject>`. Use the imperative mood, lowercase type, and no trailing period, and keep the whole line under ~72 characters. Include a scope unless the change is truly repo-wide.
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
- Small commits are the subject line only.
- Big commits add a body after a blank line: a short paragraph on what changed and why, then `-` bullets for the main changes. Wrap the body at 72 characters.

```
feat(finances): add request entry form

Let the admin enter a reimbursement for any payee in one screen,
including receipts, and save it as a draft, approved, or paid.

- Add the payee picker with search and inline "add new payee".
- Compress receipt photos in the browser before upload.
- Offer "Enter another" after saving to speed up backfill.
```

## Additional rules

<!-- Add project rules here. -->
