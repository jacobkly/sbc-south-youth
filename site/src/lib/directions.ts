/** Map links that open turn-by-turn directions to an address. */

export type MapsApp = "apple" | "google";

export function directionsUrl(address: string, app: MapsApp): string {
  const query = new URLSearchParams(
    app === "apple" ? { daddr: address } : { api: "1", destination: address },
  ).toString();
  return app === "apple" ? `https://maps.apple.com/?${query}` : `https://www.google.com/maps/dir/?${query}`;
}

/**
 * True on an iPhone or iPad, where Apple Maps is the default. iPads ask
 * for desktop sites and say they're Macs, but Macs have no touch screen.
 */
export function isAppleMobile({ userAgent, maxTouchPoints }: { userAgent: string; maxTouchPoints: number }): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}
