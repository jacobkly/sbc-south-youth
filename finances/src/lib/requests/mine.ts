import { isEditableByRequester, type RequestStatus } from "./format";

/**
 * A requester's own requests, split into the ones waiting on them and the
 * ones they've sent. Questions from an owner come first, since they hold up
 * getting paid back.
 */
export function groupMyRequests<Row extends { status: RequestStatus }>(
  rows: readonly Row[],
): { toFinish: Row[]; sent: Row[] } {
  const toFinish = rows.filter((row) => isEditableByRequester(row.status));
  return {
    toFinish: [
      ...toFinish.filter((row) => row.status === "needs_info"),
      ...toFinish.filter((row) => row.status !== "needs_info"),
    ],
    sent: rows.filter((row) => !isEditableByRequester(row.status)),
  };
}
