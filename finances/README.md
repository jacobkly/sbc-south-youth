# Finances App

Invite-only reimbursement tracker for SBC South Youth. Built with Next.js (App Router, TypeScript, Tailwind CSS) and Supabase (Postgres, Auth, Storage).

## Prerequisites

- Node.js 24 or newer
- A hosted Supabase project, or Docker Desktop for the local Supabase stack

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Local Supabase

The Supabase CLI is installed as a dev dependency, so run it with `npx`:

```bash
npx supabase start    # start the local stack (first run downloads Docker images)
npx supabase status   # show local URLs and keys for .env.local
npx supabase db reset # rebuild the local database from migrations and seed
npx supabase test db  # run database tests
npx supabase stop     # stop the local stack
```

Database schema changes are always made as migrations in `supabase/migrations`.

## Hosted Supabase

To develop against a hosted project instead of Docker, put the project's URL and publishable key in `.env.local`, then link the CLI once so `npm run db:types` can read the schema:

```bash
npx supabase link --project-ref <project-ref>
```

Migrations are applied to the hosted project in order from `supabase/migrations`.

## Preview on a phone

The dev server also listens on your network, so a phone on the same Wi-Fi can open it.

1. Find the computer's LAN address. `npm run dev` prints it as the `Network` URL, like `http://192.168.1.20:3000`.
2. On Windows, allow Node.js on private networks when the firewall asks. If you dismissed the prompt, allow it under Windows Security > Firewall > Allow an app.
3. Add the Network URL with `/**` on the end to the allowed redirect URLs:
   - Hosted: Authentication > URL Configuration > Redirect URLs in the Supabase dashboard.
   - Local: `additional_redirect_urls` in `supabase/config.toml`, then restart the stack.
4. Open the Network URL on the phone and sign in with the emailed code.

With the local stack, the phone also needs to reach Supabase. Set `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` to `http://<LAN address>:54321` instead of `127.0.0.1`, and restart `npm run dev`. Sign-in emails go to Mailpit at `http://localhost:54324` on the computer, not to a real inbox.

The LAN address can change when the router reassigns it. If the phone stops connecting, check the `Network` URL again.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |
| `npm test` | Run unit tests once (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from the linked project |
