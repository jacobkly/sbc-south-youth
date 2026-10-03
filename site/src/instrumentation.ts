import type { Instrumentation } from "next";

/**
 * Puts errors nothing else caught, from a page, route, action, or the
 * proxy, on the owners' error log. Errors an action or loader handles
 * itself are logged where they're caught, so they don't come through here.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, _request, { routePath, routeType }) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ recordError }, { routeSource }] = await Promise.all([
    import("@/lib/errors/report"),
    import("@/lib/errors/record"),
  ]);
  await recordError(routeSource(routePath, routeType), error);
};
