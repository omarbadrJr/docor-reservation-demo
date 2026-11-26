import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AuthServiceError } from "@/services/auth";
import type { AuthErrorResponse } from "@/types/auth";
import type { Database } from "@/types/database";

import { createLogoutPostHandler } from "../_shared";
import { POST } from "./route";

function createFakeSignOutClient(
  signOutHandler?: (options?: {
    scope?: "global" | "local" | "others";
  }) => Promise<{ error: { message: string } | null }>,
) {
  const signOutCalls: Array<{ scope?: "global" | "local" | "others" }> = [];

  const client = {
    auth: {
      signOut: async (options?: { scope?: "global" | "local" | "others" }) => {
        signOutCalls.push(options ?? {});
        if (signOutHandler) {
          return signOutHandler(options);
        }
        return { error: null };
      },
    },
  } as unknown as SupabaseClient<Database>;

  return { client, signOutCalls };
}

describe("POST /api/admin/logout", () => {
  it("exports a Next.js POST handler", () => {
    assert.equal(typeof POST, "function");
  });

  it("returns 200 { ok: true } with Cache-Control: no-store and signs out globally", async () => {
    const { client, signOutCalls } = createFakeSignOutClient();
    const handler = createLogoutPostHandler({
      getSupabaseClient: () => client,
    });

    const response = await handler();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { ok: true });
    assert.deepEqual(signOutCalls, [{ scope: "global" }]);
  });

  it("is idempotent across repeated calls and expired global sessions", async () => {
    const { client, signOutCalls } = createFakeSignOutClient(async (options) =>
      options?.scope === "global"
        ? { error: { message: "Auth session missing" } }
        : { error: null },
    );
    const handler = createLogoutPostHandler({
      getSupabaseClient: () => client,
    });

    const first = await handler();
    const second = await handler();

    assert.equal(first.status, 200);
    assert.equal(first.headers.get("cache-control"), "no-store");
    assert.deepEqual(await first.json(), { ok: true });

    assert.equal(second.status, 200);
    assert.equal(second.headers.get("cache-control"), "no-store");
    assert.deepEqual(await second.json(), { ok: true });

    assert.deepEqual(signOutCalls, [
      { scope: "global" },
      { scope: "local" },
      { scope: "global" },
      { scope: "local" },
    ]);
  });

  it("maps AuthServiceError and unexpected errors with Cache-Control: no-store", async () => {
    const authErrorHandler = createLogoutPostHandler({
      getSupabaseClient: async () => {
        throw new AuthServiceError(
          401,
          "UNAUTHORIZED",
          "لازم تسجل دخول الأول.",
        );
      },
    });
    const authErrResponse = await authErrorHandler();
    assert.equal(authErrResponse.status, 401);
    assert.equal(authErrResponse.headers.get("cache-control"), "no-store");
    assert.deepEqual((await authErrResponse.json()) as AuthErrorResponse, {
      error: "لازم تسجل دخول الأول.",
      code: "UNAUTHORIZED",
    });

    const { client: failingSignOutClient } = createFakeSignOutClient(
      async () => {
        throw new Error("cookie jar exploded");
      },
    );
    const unexpectedHandler = createLogoutPostHandler({
      getSupabaseClient: () => failingSignOutClient,
    });
    const unexpectedResponse = await unexpectedHandler();
    assert.equal(unexpectedResponse.status, 500);
    assert.equal(unexpectedResponse.headers.get("cache-control"), "no-store");
    assert.deepEqual((await unexpectedResponse.json()) as AuthErrorResponse, {
      error: "حصلت مشكلة في الخادم، حاول تاني بعد شوية.",
      code: "INTERNAL_ERROR",
    });
  });
});
