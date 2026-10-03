import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import { fetchAccountTheme, saveAccountTheme } from "./account-theme";

const USER_ID = "00000000-0000-4000-8000-00000000a001";

type Answer = { data: unknown; error: object | null } | Error;

/**
 * A stand-in for the Supabase client. Each update or read waits for the test
 * to answer it, so tests control the order things finish in.
 */
function fakeClient() {
  const updates: { theme: string; answer: (result: Answer) => void }[] = [];
  const reads: ((result: Answer) => void)[] = [];
  const settle = (resolve: (value: unknown) => void, reject: (error: Error) => void) => (result: Answer) =>
    result instanceof Error ? reject(result) : resolve(result);

  const client = {
    from: vi.fn(() => ({
      update: (values: { theme: string }) => ({
        eq: (column: string, id: string) => {
          expect([column, id]).toEqual(["id", USER_ID]);
          return {
            select: () =>
              new Promise((resolve, reject) => updates.push({ theme: values.theme, answer: settle(resolve, reject) })),
          };
        },
      }),
      select: () => ({
        eq: () => ({ maybeSingle: () => new Promise((resolve, reject) => reads.push(settle(resolve, reject))) }),
      }),
    })),
  };
  return { client: client as unknown as SupabaseClient<Database>, updates, reads };
}

const SAVED = { data: [{ id: USER_ID }], error: null };

/** Lets queued promise callbacks run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("saveAccountTheme", () => {
  it("saves the theme on the user's row", async () => {
    const { client, updates } = fakeClient();

    const save = saveAccountTheme(client, USER_ID, "grey");
    await flush();
    updates[0].answer(SAVED);

    await expect(save).resolves.toBeUndefined();
    expect(updates.map((update) => update.theme)).toEqual(["grey"]);
  });

  it("fails when no row came back, like a deactivated user's", async () => {
    const { client, updates } = fakeClient();

    const save = saveAccountTheme(client, USER_ID, "dark");
    await flush();
    updates[0].answer({ data: [], error: null });

    await expect(save).rejects.toThrow();
  });

  it("fails on an error or a dropped connection", async () => {
    const { client, updates } = fakeClient();

    const refused = saveAccountTheme(client, USER_ID, "dark");
    await flush();
    updates[0].answer({ data: null, error: { message: "permission denied" } });
    await expect(refused).rejects.toThrow();

    const dropped = saveAccountTheme(client, USER_ID, "dark");
    await flush();
    updates[1].answer(new TypeError("Failed to fetch"));
    await expect(dropped).rejects.toThrow();
  });

  it("saves one at a time, in the order they were picked, even after a failure", async () => {
    const { client, updates } = fakeClient();

    const first = saveAccountTheme(client, USER_ID, "dark");
    const second = saveAccountTheme(client, USER_ID, "grey");
    await flush();
    expect(updates.map((update) => update.theme)).toEqual(["dark"]);

    updates[0].answer(new TypeError("Failed to fetch"));
    await expect(first).rejects.toThrow();
    await flush();
    expect(updates.map((update) => update.theme)).toEqual(["dark", "grey"]);

    updates[1].answer(SAVED);
    await expect(second).resolves.toBeUndefined();
  });
});

describe("fetchAccountTheme", () => {
  it("reads the theme saved on the user's row", async () => {
    const { client, reads } = fakeClient();

    const theme = fetchAccountTheme(client, USER_ID);
    reads[0]({ data: { theme: "system" }, error: null });

    await expect(theme).resolves.toBe("system");
  });

  it("gives null when nothing's saved or it can't be read", async () => {
    const { client, reads } = fakeClient();

    const none = fetchAccountTheme(client, USER_ID);
    reads[0]({ data: { theme: null }, error: null });
    await expect(none).resolves.toBeNull();

    const refused = fetchAccountTheme(client, USER_ID);
    reads[1]({ data: null, error: { message: "permission denied" } });
    await expect(refused).resolves.toBeNull();

    const dropped = fetchAccountTheme(client, USER_ID);
    reads[2](new TypeError("Failed to fetch"));
    await expect(dropped).resolves.toBeNull();
  });

  it("gives null when this device saved a newer theme while it loaded", async () => {
    const { client, updates, reads } = fakeClient();

    const theme = fetchAccountTheme(client, USER_ID);
    const save = saveAccountTheme(client, USER_ID, "grey");
    await flush();
    updates[0].answer(SAVED);
    await save;
    reads[0]({ data: { theme: "light" }, error: null });

    await expect(theme).resolves.toBeNull();
  });

  it("gives null while a save is still going", async () => {
    const { client, updates, reads } = fakeClient();

    const save = saveAccountTheme(client, USER_ID, "dark");
    const theme = fetchAccountTheme(client, USER_ID);
    reads[0]({ data: { theme: "light" }, error: null });
    await expect(theme).resolves.toBeNull();

    await flush();
    updates[0].answer(SAVED);
    await save;
  });
});
