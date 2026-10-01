// The portal host's robots.txt. Search engines stay out of all of it.
export function GET() {
  return new Response("User-Agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
