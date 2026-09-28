/** A `$` and up to 20 letters, numbers, or underscores, like "$ExampleYouth". */
export const cashtagPattern = /^\$[A-Za-z0-9_]{1,20}$/;

/**
 * The Cash App page for a cashtag. Giving is only ever this link: no
 * payment code runs on the site.
 */
export function cashAppUrl(cashtag: string): string {
  if (!cashtagPattern.test(cashtag)) throw new Error(`Not a cashtag: "${cashtag}"`);
  return `https://cash.app/${cashtag}`;
}
