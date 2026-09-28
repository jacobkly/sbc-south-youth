# Site

Public website for SBC South Youth on `sbcsouthyouth.com`, for students, parents, and visitors. Built with Next.js (App Router, TypeScript, Tailwind CSS).

## Prerequisites

- Node.js 24 or newer

## Setup

```bash
npm install
npm run dev
```

The site runs at [http://localhost:3001](http://localhost:3001), so it can run next to the finances app on port 3000.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test               # Vitest unit tests (src/**/*.test.ts)
npm run build
```

## Launch gate

Until launch, production shows the coming-soon page for every page. Previews and local builds show the full site.

- The gate is decided at build time in `src/lib/launch-gate.ts`: a Vercel build that isn't a preview is gated unless `SITE_LIVE` is `true`.
- To launch, set `SITE_LIVE=true` on the site's Vercel project (Production) and redeploy.
- To check the gate locally, build with `VERCEL=1 VERCEL_ENV=production npm run build`, then `npm start`.

## Environment variables

All optional until launch. Pages show a placeholder when one is missing.

| Variable | Used for |
| --- | --- |
| `SITE_LIVE` | `true` opens the launch gate (read at build time) |
| `GIVE_CASHTAG` | The Cash App cashtag on the Give page, like `$ExampleYouth`. Without it, Give shows a "coming soon" card and the Give buttons stay hidden |
