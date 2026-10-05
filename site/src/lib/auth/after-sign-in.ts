import { readPortalEnv, type PortalEnv } from "@/lib/env";
import { safeNextPath, START_PATH } from "./next-path";

/**
 * Where signing in ends: the page a link asked for, on the portal or, once
 * the two share a sign-in, on finances. Without one, the "Where to?" page.
 */
export function nextAfterSignIn(
  value: string | null | undefined,
  env: Pick<PortalEnv, "sharedSignIn" | "financesUrl"> = readPortalEnv(),
): string {
  return safeNextPath(value, START_PATH, env.sharedSignIn ? [env.financesUrl] : []);
}
