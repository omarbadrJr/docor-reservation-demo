import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createLoginRateLimiter } from "@/lib/auth/rate-limit";
import type { AuthErrorResponse, LoginResponse } from "@/types/auth";
import type { AdminProfile, Clinic, Database } from "@/types/database";

import { createLoginPostHandler, noStoreJson } from "../_shared";
import { POST } from "./route";

const OWNER_ID = "aa000000-0000-0000-0000-000000000001";
const RECEPTIONIST_ID = "aa000000-0000-0000-0000-000000000002";
const CLINIC_ID = "11000000-0000-0000-0000-000000000001";

function makeAdminProfileRow(
  overrides: Partial<AdminProfile> = {},
): AdminProfile {
  return {
    id: OWNER_ID,
    name: "أحمد شريف",
    email: "owner@example.com",
    role: "OWNER",
    clinic_id: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeClinicRow(overrides: Partial<Clinic> = {}): Clinic {
  return {
    id: CLINIC_ID,
    name: "عيادة النيل التخصصية",
    address: "شارع الجمهورية، دمنهور، البحيرة",
    phone: "0453311223",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function createFakeAdminClient(
  dataset: {
    admin_profiles: AdminProfile[];
    clinics: Clinic[];
  },
  options?: { adminProfilesError?: { message: string } | null },
): SupabaseClient<Database> {
  return {
    from(table: "admin_profiles" | "clinics") {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];

      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => {
          filters.push((row) => row[key] === value);
          return builder;
        },
        maybeSingle: async () => {
          if (table === "admin_profiles" && options?.adminProfilesError) {
            return { data: null, error: options.adminProfilesError };
          }

          const rows = (
            dataset[table] as unknown as Record<string, unknown>[]
          ).filter((row) => filters.every((filter) => filter(row)));

          return { data: rows[0] ?? null, error: null };
        },
      };

      return builder;
    },
  } as unknown as SupabaseClient<Database>;
}

function createFakeAuthClient(handlers?: {
  signInWithPassword?: (credentials: {
    email: string;
    password: string;
  }) => Promise<{
    data: { user: { id: string } | null };
    error: { message: string } | null;
  }>;
  signOut?: () => Promise<{ error: { message: string } | null }>;
}) {
  const signInCalls: Array<{ email: string; password: string }> = [];
  let signOutCalls = 0;

  const client = {
    auth: {
      signInWithPassword: async (credentials: {
        email: string;
        password: string;
      }) => {
        signInCalls.push(credentials);
        if (handlers?.signInWithPassword) {
          return handlers.signInWithPassword(credentials);
        }
        return { data: { user: null }, error: { message: "Invalid credentials" } };
      },
      signOut: async () => {
        signOutCalls += 1;
        if (handlers?.signOut) {
          return handlers.signOut();
        }
        return { error: null };
      },
    },
  } as unknown as SupabaseClient<Database>;

  return {
    client,
    signInCalls,
    getSignOutCalls: () => signOutCalls,
  };
}

function makeLoginRequest(body: string, ip = "203.0.113.10"): Request {
  return new Request("http://localhost/api/admin/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body,
  });
}

describe("noStoreJson", () => {
  it("always enforces Cache-Control: no-store alongside custom headers", async () => {
    const response = noStoreJson(
      { ok: true },
      {
        status: 201,
        headers: {
          "Cache-Control": "public, max-age=3600",
          "X-Custom": "present",
        },
      },
    );

    assert.equal(response.status, 201);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-custom"), "present");
    assert.deepEqual(await response.json(), { ok: true });
  });
});

describe("POST /api/admin/login", () => {
  it("exports a Next.js POST handler that rejects malformed JSON with 400 and no-store", async () => {
    assert.equal(typeof POST, "function");

    const response = await POST(makeLoginRequest("{bad-json"));

    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual((await response.json()) as AuthErrorResponse, {
      error: "بيانات الدخول مش مظبوطة، راجعها وحاول تاني.",
      code: "VALIDATION_ERROR",
    });
  });

  it("returns 400 VALIDATION_ERROR with fieldErrors for invalid payload without creating clients", async () => {
    let clientFactoryCalled = false;
    const handler = createLoginPostHandler({
      getSupabaseClient: () => {
        clientFactoryCalled = true;
        throw new Error("should not be called");
      },
      getAdminClient: () => {
        clientFactoryCalled = true;
        throw new Error("should not be called");
      },
    });

    const missingBoth = await handler(makeLoginRequest(JSON.stringify({})));
    assert.equal(missingBoth.status, 400);
    assert.equal(missingBoth.headers.get("cache-control"), "no-store");
    assert.deepEqual((await missingBoth.json()) as AuthErrorResponse, {
      error: "بيانات الدخول مش مظبوطة، راجعها وحاول تاني.",
      code: "VALIDATION_ERROR",
      fieldErrors: {
        email: "اكتب البريد الإلكتروني",
        password: "اكتب كلمة المرور",
      },
    });

    const invalidEmail = await handler(
      makeLoginRequest(
        JSON.stringify({ email: "not-an-email", password: "secret" }),
      ),
    );
    assert.equal(invalidEmail.status, 400);
    assert.equal(invalidEmail.headers.get("cache-control"), "no-store");
    assert.deepEqual((await invalidEmail.json()) as AuthErrorResponse, {
      error: "اكتب بريد إلكتروني صحيح",
      code: "VALIDATION_ERROR",
      fieldErrors: {
        email: "اكتب بريد إلكتروني صحيح",
      },
    });

    const nonObject = await handler(makeLoginRequest(JSON.stringify([])));
    assert.equal(nonObject.status, 400);
    assert.equal(nonObject.headers.get("cache-control"), "no-store");
    assert.deepEqual((await nonObject.json()) as AuthErrorResponse, {
      error: "بيانات الدخول مش مظبوطة، راجعها وحاول تاني.",
      code: "VALIDATION_ERROR",
      fieldErrors: {},
    });

    assert.equal(clientFactoryCalled, false);
  });

  it("returns 401 INVALID_CREDENTIALS with no-store when credentials fail", async () => {
    const { client: authClient, signInCalls } = createFakeAuthClient({
      signInWithPassword: async () => ({
        data: { user: null },
        error: { message: "Invalid login credentials" },
      }),
    });
    const adminClient = createFakeAdminClient({
      admin_profiles: [],
      clinics: [],
    });

    const handler = createLoginPostHandler({
      getSupabaseClient: () => authClient,
      getAdminClient: () => adminClient,
      rateLimiter: createLoginRateLimiter(),
    });

    const response = await handler(
      makeLoginRequest(
        JSON.stringify({
          email: "  OWNER@Example.COM ",
          password: "wrong-password",
        }),
      ),
    );

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(signInCalls, [
      { email: "owner@example.com", password: "wrong-password" },
    ]);
    assert.deepEqual((await response.json()) as AuthErrorResponse, {
      error: "البريد الإلكتروني أو كلمة المرور غلط.",
      code: "INVALID_CREDENTIALS",
    });
  });

  it("returns 403 ACCOUNT_INACTIVE and signs out when profile is inactive", async () => {
    const { client: authClient, getSignOutCalls } = createFakeAuthClient({
      signInWithPassword: async () => ({
        data: { user: { id: RECEPTIONIST_ID } },
        error: null,
      }),
    });
    const adminClient = createFakeAdminClient({
      admin_profiles: [
        makeAdminProfileRow({
          id: RECEPTIONIST_ID,
          role: "RECEPTIONIST",
          clinic_id: CLINIC_ID,
          is_active: false,
        }),
      ],
      clinics: [makeClinicRow()],
    });

    const handler = createLoginPostHandler({
      getSupabaseClient: () => authClient,
      getAdminClient: () => adminClient,
      rateLimiter: createLoginRateLimiter(),
    });

    const response = await handler(
      makeLoginRequest(
        JSON.stringify({
          email: "receptionist@example.com",
          password: "correct-password",
        }),
      ),
    );

    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(getSignOutCalls(), 1);
    assert.deepEqual((await response.json()) as AuthErrorResponse, {
      error: "الحساب ده غير نشط حالياً. تواصل مع إدارة المنصة.",
      code: "ACCOUNT_INACTIVE",
    });
  });

  it("returns 429 RATE_LIMITED with Retry-After and no-store after repeated failures", async () => {
    const { client: authClient, signInCalls } = createFakeAuthClient({
      signInWithPassword: async () => ({
        data: { user: null },
        error: { message: "Invalid login credentials" },
      }),
    });
    const adminClient = createFakeAdminClient({
      admin_profiles: [],
      clinics: [],
    });
    const rateLimiter = createLoginRateLimiter({
      windowMs: 60_000,
      maxPerPair: 2,
      maxPerIp: 10,
    });

    const handler = createLoginPostHandler({
      getSupabaseClient: () => authClient,
      getAdminClient: () => adminClient,
      rateLimiter,
    });

    const payload = JSON.stringify({
      email: "owner@example.com",
      password: "wrong-password",
    });

    const first = await handler(makeLoginRequest(payload, "198.51.100.77"));
    const second = await handler(makeLoginRequest(payload, "198.51.100.77"));
    const third = await handler(makeLoginRequest(payload, "198.51.100.77"));

    assert.equal(first.status, 401);
    assert.equal(second.status, 401);
    assert.equal(signInCalls.length, 2);

    assert.equal(third.status, 429);
    assert.equal(third.headers.get("cache-control"), "no-store");
    const body = (await third.json()) as AuthErrorResponse;
    assert.equal(body.code, "RATE_LIMITED");
    assert.equal(
      body.error,
      "جربت كتير تدخل بحساب غلط، استنى شوية وحاول تاني.",
    );
    assert.equal(typeof body.retryAfterSeconds, "number");
    assert.ok((body.retryAfterSeconds ?? 0) > 0);
    assert.equal(
      third.headers.get("retry-after"),
      String(body.retryAfterSeconds),
    );
  });

  it("returns 200 with staff profile, sanitized redirectTo, and no-store on valid login", async () => {
    const rateLimiter = createLoginRateLimiter({
      windowMs: 60_000,
      maxPerPair: 2,
      maxPerIp: 10,
    });
    rateLimiter.recordFailure("203.0.113.50", "owner@example.com");

    const { client: authClient } = createFakeAuthClient({
      signInWithPassword: async () => ({
        data: { user: { id: OWNER_ID } },
        error: null,
      }),
    });
    const adminClient = createFakeAdminClient({
      admin_profiles: [makeAdminProfileRow()],
      clinics: [],
    });

    const handler = createLoginPostHandler({
      getSupabaseClient: () => authClient,
      getAdminClient: () => adminClient,
      rateLimiter,
    });

    const response = await handler(
      makeLoginRequest(
        JSON.stringify({
          email: "  OWNER@Example.COM ",
          password: "correct-password",
          next: "/owner/doctors?status=active",
        }),
        "203.0.113.50",
      ),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual((await response.json()) as LoginResponse, {
      user: {
        id: OWNER_ID,
        name: "أحمد شريف",
        email: "owner@example.com",
        role: "OWNER",
        clinicId: null,
        clinicName: null,
        isActive: true,
      },
      redirectTo: "/owner/doctors?status=active",
    });

    assert.deepEqual(
      rateLimiter.check("203.0.113.50", "owner@example.com"),
      { allowed: true },
    );
  });

  it("returns 500 INTERNAL_ERROR with no-store on unexpected errors", async () => {
    const handler = createLoginPostHandler({
      getSupabaseClient: async () => {
        throw new Error("unexpected secret failure");
      },
      getAdminClient: () =>
        createFakeAdminClient({ admin_profiles: [], clinics: [] }),
      rateLimiter: createLoginRateLimiter(),
    });

    const response = await handler(
      makeLoginRequest(
        JSON.stringify({
          email: "owner@example.com",
          password: "correct-password",
        }),
      ),
    );

    assert.equal(response.status, 500);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual((await response.json()) as AuthErrorResponse, {
      error: "حصلت مشكلة في الخادم، حاول تاني بعد شوية.",
      code: "INTERNAL_ERROR",
    });
  });
});
