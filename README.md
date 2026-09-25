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

## Deployment

Each app is its own Vercel project connected to this repo, with its **Root Directory** set to the app's folder and builds skipped when that folder hasn't changed.

## License

[MIT](LICENSE)
