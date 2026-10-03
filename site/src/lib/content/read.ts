/**
 * A read, or null if it fails while building or in development, so the
 * build still finishes and pages show their empty states. Once the site
 * is running, the error stands instead, and Next keeps serving the last
 * good page until a later try works.
 */
export async function readOrNothing<T>(what: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    const building = process.env.NEXT_PHASE === "phase-production-build";
    if (!building && process.env.NODE_ENV !== "development") throw error;
    console.error(`[site] Couldn't load the ${what}, so pages show none for now.`, error);
    return null;
  }
}
