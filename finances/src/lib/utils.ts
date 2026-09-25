export { cn } from "cn"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether an id from the URL is well formed. A malformed one would be a database error, not a missing row. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
