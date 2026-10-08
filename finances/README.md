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

## Supabase

The Supabase project lives in [`supabase/`](../supabase/) at the repo root, since the site and its leader portal share it. Run the Supabase CLI from the repo root after `npm install` there. See the root [README](../README.md#database) for the commands.

For local development, `.env.local` can hold the hosted project's URL and publishable key, so you sign in as yourself to the real data. For the local stack and the seed's fake people, run it with Docker Desktop, put the values from `npx supabase status` in `.env.test.local`, and start the app with `npm run dev:local`. It uses that file in place of `.env.local`, and won't start with a Supabase address off this computer or network.

The local stack loads [`supabase/seed.sql`](../supabase/seed.sql) on `npx supabase db reset`: fake people for each kind of access (an owner, a finance viewer, a requester, and a site-only leader), payees, and requests in every status. Its header comment has the local sign-ins.

People and roles are managed in the leader portal. Owners invite people there, and a requester or finance viewer then signs in here with the password they chose.

### One sign-in

Set `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` to the same value as the portal's, and finances shares the portal's sign-in. Its sign-in, forgot password, and setup pages then send people to the portal's, which sends them back here afterward. `PORTAL_URL` and `FINANCES_URL` must match the portal's own. The name at the top of the sidebar, the logo at the top of the rail, and Switch to in the More sheet move to the portal or the public site. `src/lib/destinations.ts` lists the portal's sections by role, written out to match the portal's navigation, so change it when the portal's change. The site's [README](../site/README.md#one-sign-in) has the details and the local setup.

## Preview on a phone

The dev server also listens on your network, so a phone on the same Wi-Fi can open it.

1. Find the computer's LAN address. `npm run dev` prints it as the `Network` URL, like `http://192.168.1.20:3000`.
2. On Windows, allow Node.js on private networks when the firewall asks. If you dismissed the prompt, allow it under Windows Security > Firewall > Allow an app.
3. Open the Network URL on the phone and sign in with your email and password.

With the local stack, the phone also needs to reach Supabase. Set `NEXT_PUBLIC_SUPABASE_URL` in `.env.test.local` to `http://<LAN address>:54321` instead of `127.0.0.1`, and restart `npm run dev:local`.

Sign-in doesn't use redirects, but links in emails (such as invites) return through `/auth/callback`. To follow one on the phone, first add the Network URL with `/**` on the end to the allowed redirect URLs:

- Hosted: Authentication > URL Configuration > Redirect URLs in the Supabase dashboard.
- Local: `additional_redirect_urls` in `supabase/config.toml` at the repo root, then restart the stack. Local emails go to Mailpit at `http://localhost:54324` on the computer, not to a real inbox.

The LAN address can change when the router reassigns it. If the phone stops connecting, check the `Network` URL again.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run dev:local` | Start it against the local stack, with `.env.test.local` |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |
| `npm test` | Run unit tests once (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
