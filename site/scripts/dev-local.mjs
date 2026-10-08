// `npm run dev:local`: the dev server against the local Supabase stack and
// the seed's fake people. Plain `npm run dev` reads .env.local, which can
// point at the hosted project, so this sets .env.test.local's values first.
// Next never replaces a variable that's already set, and one only
// .env.local has is set blank, which the app reads as unset.
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

// This computer, or another one on a private network, for a phone preview.
const LOCAL_HOSTS = [
  /^(.+\.)?localhost$/,
  /^127(\.\d+){3}$/,
  /^10(\.\d+){3}$/,
  /^192\.168(\.\d+){2}$/,
  /^172\.(1[6-9]|2\d|3[01])(\.\d+){2}$/,
  // Tailscale and other carrier-grade NAT.
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])(\.\d+){2}$/,
];

function read(file) {
  try {
    return parseEnv(readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

const local = read(".env.test.local");
if (!local) {
  console.error("dev:local needs .env.test.local with the local stack's values. See .env.example.");
  process.exit(1);
}
for (const [key, value] of Object.entries(local)) process.env[key] ??= value;
for (const key of Object.keys(read(".env.local") ?? {})) process.env[key] ??= "";

const supabase = URL.parse(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
if (!supabase || !LOCAL_HOSTS.some((host) => host.test(supabase.hostname))) {
  console.error("dev:local only runs against the local stack: check NEXT_PUBLIC_SUPABASE_URL in .env.test.local.");
  process.exit(1);
}
// Next still lists .env.local as loaded, but uses none of its values.
console.log(`dev:local: .env.test.local, with Supabase at ${supabase.origin}`);

// Runs as `next dev` with this script's arguments.
process.argv.splice(2, 0, "dev");
await import("next/dist/bin/next");
