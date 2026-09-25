# Finances App

Invite-only reimbursement tracker for SBC South Youth. Built with Next.js (App Router, TypeScript, Tailwind CSS) and Supabase (Postgres, Auth, Storage).

## Prerequisites

- Node.js 24 or newer
- Docker Desktop (for the local Supabase stack)

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

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |
| `npm test` | Run unit tests once (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from the local database |
