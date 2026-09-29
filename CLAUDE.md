# CLAUDE.md

Guidance for Claude Code in this repo.

## Project

Monorepo for SBC South Youth web projects on `sbcsouthyouth.com`. Each app is its own folder and its own Vercel project.

- `finances/`: invite-only reimbursement tracker (`finances.` subdomain). Next.js 16 (App Router, TypeScript strict, Tailwind v4) and Supabase (Postgres, Auth, Storage). In maintenance.
- `site/`: public youth website on the apex domain, for students, parents, and visitors, with no logins. Next.js 16 (App Router, TypeScript strict, Tailwind v4). **Active.** A small leader portal on `portal.` comes later from the same app. It shares the Supabase project, but it must never read or display finance data.
- `supabase/`: the Supabase project both apps share: migrations, config, and email templates.

## Current focus

- **The public site is the active work.** Build its design, UI, and flows first, using fake content and hotlinked placeholder photos. Forms validate but don't save or send yet (`TODO(wire-up)`). Wiring them to Supabase, email, and bot protection comes with the portal.
- **Finances** gets bug fixes and small features. Its Phase 1 (admin only) is the real target. Phase 2 (member self-service) may shrink to invite-only `viewer` accounts, so keep the cheap Phase 2 hooks in the schema (`payees.user_id`, full status RPCs) but don't build member-facing features. Receipts live in Supabase Storage, compressed in the browser to fit the 1 GB free tier.

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
- Read roles from `public.users.role` via `current_app_role()`, never from `user_metadata`.
- `anon` gets no access to anything.
- The site's tables and functions live in their own `site` schema, never in `public`.
- The service role key never goes in the frontend or any `NEXT_PUBLIC_` variable.

### Database

- All schema changes go in Supabase CLI migrations in `supabase/migrations`. No dashboard-only changes.
- `uuid` PKs (`gen_random_uuid()`), `timestamptz`, and `created_at`/`updated_at` with an `updated_at` trigger.
- Money is stored as integer cents and displayed as USD.
- All period math (month, quarter, year, "future date") uses `America/Los_Angeles`.

### Frontend

- Next.js 16 has breaking changes from older versions. Check `finances/node_modules/next/dist/docs/` before using an API you're unsure of (see `finances/AGENTS.md`).
- The finances app stays out of search engines: `robots.txt` disallows everything and metadata sets `noindex, nofollow`.
- **Mobile-first.** The main user is on an iPhone, so design and check every screen at phone width in iOS Safari first. Desktop must work, but desktop-optimized layouts come later.
- In finances (and later the portal), use shadcn/ui components (in `src/components/ui`) for dialogs, pickers, tabs, and menus instead of hand-rolling them.
- Accessible, with loading, empty, and error states on every screen.

### Public site (`site/`)

- **Design-led, not a productivity tool.** Dark-first "night service poster" look: near-black, big display type, real photos, and one bright accent. Design tokens live in `site/src/app/globals.css`. Check every screen at 375 px and 1280 px, in dark and light.
- No shadcn or Radix on the public site. Use styled native form controls (native `<select>` gives the iOS picker) and native `<dialog>`.
- Server Components by default. Client Components only for interactive islands. Animate with CSS transitions and keyframes (no animation library), only `transform`, `translate`, `scale`, and `opacity`, and every animation respects reduced motion. Home JS stays under 150 KB gzipped, and the framework alone is about 135 KB.
- Page copy lives in `site/src/content/`. Anything leadership must approve (times, address, bios, safety policy, giving wording) is a placeholder marked `TODO(leadership)`. Never invent facts about the church, its people, or its policies.
- Minors' privacy: never commit photos of students, and never show a student's last name, school, contact details, or social handle. Never render a group chat invite link.
- Placeholder photos are hotlinked, never committed. Every one is replaced before launch.
- **Launch gate:** a Vercel production build serves `/coming-soon` for every page until `SITE_LIVE=true` is set on the site's Vercel project. Never remove or bypass the gate without the maintainer.
- **Staging:** the `dev` branch deploys to `staging.sbcsouthyouth.com`, a Vercel preview behind Vercel Authentication that always shows the full site. Before launch, the maintainer pushes `main` to both branches. After launch, site changes go to `dev` first and reach `main` once they're checked on staging.
- The Supabase secret key is only for the site's server, in `server-only` modules. It may only call functions that `service_role` alone can execute, and never reads tables.

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
