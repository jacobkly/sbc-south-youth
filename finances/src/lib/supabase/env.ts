/**
 * Public Supabase settings. The publishable key is safe in the browser;
 * Row Level Security decides what it can reach.
 */
export function supabaseEnv() {
  // Referenced directly so Next inlines them into the client bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }

  return { url, key };
}
