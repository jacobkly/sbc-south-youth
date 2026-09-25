# SBC South Youth

Web projects for SBC South Youth. This repo holds every app under the `sbcsouthyouth.com` domain. Each app lives in its own folder and deploys on its own.

## Apps

| Folder | What it is | Status |
|---|---|---|
| [`finances/`](finances/) | Invite-only app for tracking reimbursements, receipts, and expense reports for the youth ministry | In development |
| `site/` | Public youth website (about, events, photos, contact) | Planned |

## Finances app

Members who buy supplies for the youth cafe or youth events get paid back by the ministry. The finances app keeps a record of each reimbursement: who was paid, what it was for, the receipts, and its approval and payment status. It also produces monthly, quarterly, and yearly reports and CSV exports.

The app only keeps records. It never moves money.

**Stack:** Next.js (TypeScript, App Router, Tailwind CSS), Supabase (Postgres, Auth, Storage), hosted on Vercel.

See [`finances/README.md`](finances/README.md) for local setup.

## Database

Both apps use one Supabase project, kept in [`supabase/`](supabase/): migrations, config, and email templates. The Supabase CLI is installed at the repo root, so run these from here:

```bash
npm install                                  # installs the Supabase CLI
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run               # list migrations the hosted project doesn't have yet
npx supabase db push                         # apply them, in order
npm run db:types                             # regenerate the finances app's database types
```

With Docker Desktop, `npx supabase start` runs a local stack instead, `npx supabase db reset` rebuilds it from the migrations, and `npx supabase test db` runs the database tests.

## Deployment

Each app is its own Vercel project connected to this repo, with its **Root Directory** set to the app's folder and builds skipped when that folder hasn't changed.

## License

[MIT](LICENSE)
