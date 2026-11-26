import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { toAuthErrorResponse } from "@/lib/auth/guards";
import { createLoginRateLimiter, type LoginRateLimiter } from "@/lib/auth/rate-limit";
import type { AuthErrorResponse, StaffProfile } from "@/types/auth";
import type { AdminProfile, Clinic, Database } from "@/types/database";

import {
  AuthServiceError,
  assertClinicAccess,
  assertRole,
  getCurrentStaffSession,
  getStaffProfileByUserId,
  loginStaff,
  logoutStaff,
} from "./auth";

const OWNER_ID = "aa000000-0000-0000-0000-000000000001";
const RECEPTIONIST_ID = "aa000000-0000-0000-0000-000000000002";
const CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const OTHER_CLINIC_ID = "11000000-0000-0000-0000-000000000002";

type DbError = { message: string } | null;

type AdminDataset = {
  admin_profiles: AdminProfile[];
  clinics: Clinic[];
};

function makeAdminProfileRow(
  overrides: Partial<AdminProfile> = {},
): AdminProfile {
  return {
    id: RECEPTIONIST_ID,
    name: "منى إبراهيم",
    email: "receptionist@example.com",
    role: "RECEPTIONIST",
    clinic_id: CLINIC_ID,
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

function makeStaffProfile(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: RECEPTIONIST_ID,
    name: "منى إبراهيم",
    email: "receptionist@example.com",
    role: "RECEPTIONIST",
    clinicId: CLINIC_ID,
    clinicName: "عيادة النيل التخصصية",
    isActive: true,
    ...overrides,
  };
}

function fakeAdminClient(
  dataset: AdminDataset,
  options?: {
    adminProfilesError?: DbError;
    clinicsError?: DbError;
  },
) {
  const queriedTables: string[] = [];

  const client = {
    from(table: keyof AdminDataset) {
      queriedTables.push(table);
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
          if (table === "clinics" && options?.clinicsError) {
            return { data: null, error: options.clinicsError };
          }

          const rows = (
            dataset[table] as unknown as Record<string, unknown>[]
          ).filter((row) => filters.every((filter) => filter(row)));

          return { data: rows[0] ?? null, error: null };
        },
      };

      return builder;
    },
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    queriedTables,
  };
}

function fakeAuthClient(handlers?: {
  getUser?: () => Promise<{
    data: { user: { id: string } | null };
    error: { message: string } | null;
  }>;
  signInWithPassword?: (credentials: {
    email: string;
    password: string;
  }) => Promise<{
    data: { user: { id: string } | null };
    error: { message: string } | null;
  }>;
  signOut?: (options?: {
    scope?: "global" | "local" | "others";
  }) => Promise<{ error: { message: string } | null }>;
}) {
  const signOutCalls: Array<{ scope?: "global" | "local" | "others" }> = [];
  let signInCalls = 0;

  const client = {
    auth: {
      getUser: async () => {
        if (handlers?.getUser) {
          return handlers.getUser();
        }
        return { data: { user: null }, error: null };
      },
      signInWithPassword: async (credentials: {
        email: string;
        password: string;
      }) => {
        signInCalls += 1;
        if (handlers?.signInWithPassword) {
          return handlers.signInWithPassword(credentials);
        }
        return { data: { user: null }, error: { message: "Invalid login" } };
      },
      signOut: async (options?: { scope?: "global" | "local" | "others" }) => {
        signOutCalls.push(options ?? {});
        if (handlers?.signOut) {
          return handlers.signOut(options);
        }
        return { error: null };
      },
    },
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    signOutCalls,
    getSignInCalls: () => signInCalls,
  };
}

describe("getStaffProfileByUserId", () => {
  it("returns receptionist profile with resolved clinicName", async () => {
    const { client, queriedTables } = fakeAdminClient({
      admin_profiles: [makeAdminProfileRow()],
      clinics: [makeClinicRow()],
    });

    const profile = await getStaffProfileByUserId(client, RECEPTIONIST_ID);

    assert.deepEqual(profile, {
      id: RECEPTIONIST_ID,
      name: "منى إبراهيم",
      email: "receptionist@example.com",
      role: "RECEPTIONIST",
      clinicId: CLINIC_ID,
      clinicName: "عيادة النيل التخصصية",
      isActive: true,
    });
    assert.deepEqual(queriedTables, ["admin_profiles", "clinics"]);
  });

  it("returns receptionist profile with null clinicName when clinic row is missing", async () => {
    const { client } = fakeAdminClient({
      admin_profiles: [makeAdminProfileRow()],
      clinics: [],
    });

    const profile = await getStaffProfileByUserId(client, RECEPTIONIST_ID);

    assert.equal(profile?.clinicId, CLINIC_ID);
    assert.equal(profile?.clinicName, null);
  });

  it("returns owner profile with null clinic fields without querying clinics", async () => {
    const { client, queriedTables } = fakeAdminClient({
      admin_profiles: [
        makeAdminProfileRow({
          id: OWNER_ID,
          name: "أحمد شريف",
          email: "owner@example.com",
          role: "OWNER",
          clinic_id: null,
        }),
      ],
      clinics: [makeClinicRow()],
    });

    const profile = await getStaffProfileByUserId(client, OWNER_ID);

    assert.deepEqual(profile, {
      id: OWNER_ID,
      name: "أحمد شريف",
      email: "owner@example.com",
      role: "OWNER",
      clinicId: null,
      clinicName: null,
      isActive: true,
    });
    assert.deepEqual(queriedTables, ["admin_profiles"]);
  });

  it("returns null when admin_profiles row does not exist", async () => {
    const { client } = fakeAdminClient({
      admin_profiles: [],
      clinics: [],
    });

    const profile = await getStaffProfileByUserId(client, OWNER_ID);
    assert.equal(profile, null);
  });

  it("throws 500 AuthServiceError on admin_profiles or clinics database errors", async () => {
    const { client: profileErrClient } = fakeAdminClient(
      { admin_profiles: [], clinics: [] },
      { adminProfilesError: { message: "connection failed" } },
    );

    await assert.rejects(
      () => getStaffProfileByUserId(profileErrClient, OWNER_ID),
      (err: unknown) =>
        err instanceof AuthServiceError &&
        err.status === 500 &&
        err.code === "INTERNAL_ERROR",
    );

    const { client: clinicErrClient } = fakeAdminClient(
      { admin_profiles: [makeAdminProfileRow()], clinics: [] },
      { clinicsError: { message: "clinic query failed" } },
    );

    await assert.rejects(
      () => getStaffProfileByUserId(clinicErrClient, RECEPTIONIST_ID),
      (err: unknown) =>
        err instanceof AuthServiceError &&
        err.status === 500 &&
        err.code === "INTERNAL_ERROR",
    );
  });
});

describe("getCurrentStaffSession", () => {
  it("returns null when auth.getUser returns an error or no user", async () => {
    const { client: adminClient } = fakeAdminClient({
      admin_profiles: [makeAdminProfileRow()],
      clinics: [makeClinicRow()],
    });

    const { client: errAuth } = fakeAuthClient({
      getUser: async () => ({
        data: { user: null },
        error: { message: "Auth session missing" },
      }),
    });
    assert.equal(await getCurrentStaffSession(errAuth, adminClient), null);

    const { client: emptyAuth } = fakeAuthClient({
      getUser: async () => ({
        data: { user: null },
        error: null,
      }),
    });
    assert.equal(await getCurrentStaffSession(emptyAuth, adminClient), null);
  });

  it("returns null when linked profile is missing or inactive", async () => {
    const { client: authClient } = fakeAuthClient({
      getUser: async () => ({
        data: { user: { id: RECEPTIONIST_ID } },
        error: null,
      }),
    });

    const { client: missingProfileAdmin } = fakeAdminClient({
      admin_profiles: [],
      clinics: [],
    });
    assert.equal(
      await getCurrentStaffSession(authClient, missingProfileAdmin),
      null,
    );

    const { client: inactiveProfileAdmin } = fakeAdminClient({
      admin_profiles: [makeAdminProfileRow({ is_active: false })],
      clinics: [makeClinicRow()],
    });
    assert.equal(
      await getCurrentStaffSession(authClient, inactiveProfileAdmin),
      null,
    );
  });

  it("returns active staff profile when authenticated", async () => {
    const { client: authClient } = fakeAuthClient({
      getUser: async () => ({
        data: { user: { id: RECEPTIONIST_ID } },
        error: null,
      }),
    });
    const { client: adminClient } = fakeAdminClient({
      admin_profiles: [makeAdminProfileRow()],
      clinics: [makeClinicRow()],
    });

    const session = await getCurrentStaffSession(authClient, adminClient);
    assert.deepEqual(session, makeStaffProfile());
  });
});

describe("loginStaff", () => {
  it("returns staff profile, sanitized next path, and resets rate limiter on success", async () => {
    const rateLimiter = createLoginRateLimiter({
      windowMs: 60_000,
      maxPerPair: 5,
      maxPerIp: 15,
    });
    rateLimiter.recordFailure("203.0.113.10", "owner@example.com");

    const { client: adminClient } = fakeAdminClient({
      admin_profiles: [
        makeAdminProfileRow({
          id: OWNER_ID,
          name: "أحمد شريف",
          email: "owner@example.com",
          role: "OWNER",
          clinic_id: null,
        }),
      ],
      clinics: [],
    });

    const { client: authClient } = fakeAuthClient({
      signInWithPassword: async () => ({
        data: { user: { id: OWNER_ID } },
        error: null,
      }),
    });

    const validNextResult = await loginStaff(
      { supabaseClient: authClient, adminClient, rateLimiter },
      {
        email: "owner@example.com",
        password: "secret-password",
        next: "/owner/doctors?filter=active",
      },
      "203.0.113.10",
    );

    assert.equal(validNextResult.user.id, OWNER_ID);
    assert.equal(validNextResult.redirectTo, "/owner/doctors?filter=active");

    // Unsafe external or cross-role `next` values fall back to role default.
    const unsafeNextResult = await loginStaff(
      { supabaseClient: authClient, adminClient, rateLimiter },
      {
        email: "owner@example.com",
        password: "secret-password",
        next: "https://evil.example/steal",
      },
      "203.0.113.10",
    );
    assert.equal(unsafeNextResult.redirectTo, "/owner");

    const crossRoleResult = await loginStaff(
      { supabaseClient: authClient, adminClient, rateLimiter },
      {
        email: "owner@example.com",
        password: "secret-password",
        next: "/receptionist",
      },
      "203.0.113.10",
    );
    assert.equal(crossRoleResult.redirectTo, "/owner");
  });

  it("throws 429 RATE_LIMITED without calling Supabase Auth when blocked", async () => {
    const rateLimiter: LoginRateLimiter = {
      check: () => ({ allowed: false, retryAfterSeconds: 42 }),
      recordFailure: () => {
        throw new Error("should not record failure");
      },
      reset: () => {
        throw new Error("should not reset");
      },
    };
    const { client: authClient, getSignInCalls } = fakeAuthClient();
    const { client: adminClient } = fakeAdminClient({
      admin_profiles: [],
      clinics: [],
    });

    await assert.rejects(
      () =>
        loginStaff(
          { supabaseClient: authClient, adminClient, rateLimiter },
          { email: "owner@example.com", password: "wrong" },
          "203.0.113.10",
        ),
      (err: unknown) =>
        err instanceof AuthServiceError &&
        err.status === 429 &&
        err.code === "RATE_LIMITED" &&
        err.retryAfterSeconds === 42 &&
        err.message === "جربت كتير تدخل بحساب غلط، استنى شوية وحاول تاني.",
    );

    assert.equal(getSignInCalls(), 0);
  });

  it("records failure and throws generic 401 INVALID_CREDENTIALS on bad credentials", async () => {
    const recordedFailures: Array<{ ip: string; email: string }> = [];
    const baseLimiter = createLoginRateLimiter();
    const rateLimiter: LoginRateLimiter = {
      check: (ip, email) => baseLimiter.check(ip, email),
      recordFailure: (ip, email) => {
        recordedFailures.push({ ip, email });
        baseLimiter.recordFailure(ip, email);
      },
      reset: (ip, email) => baseLimiter.reset(ip, email),
    };

    const { client: authErrorClient } = fakeAuthClient({
      signInWithPassword: async () => ({
        data: { user: null },
        error: { message: "Invalid login credentials" },
      }),
    });
    const { client: adminClient } = fakeAdminClient({
      admin_profiles: [],
      clinics: [],
    });

    await assert.rejects(
      () =>
        loginStaff(
          { supabaseClient: authErrorClient, adminClient, rateLimiter },
          { email: "staff@example.com", password: "wrong" },
          "198.51.100.5",
        ),
      (err: unknown) =>
        err instanceof AuthServiceError &&
        err.status === 401 &&
        err.code === "INVALID_CREDENTIALS" &&
        err.message === "البريد الإلكتروني أو كلمة المرور غلط.",
    );

    const { client: noUserClient } = fakeAuthClient({
      signInWithPassword: async () => ({
        data: { user: null },
        error: null,
      }),
    });

    await assert.rejects(
      () =>
        loginStaff(
          { supabaseClient: noUserClient, adminClient, rateLimiter },
          { email: "other@example.com", password: "wrong" },
          "198.51.100.6",
        ),
      (err: unknown) =>
        err instanceof AuthServiceError &&
        err.status === 401 &&
        err.code === "INVALID_CREDENTIALS",
    );

    assert.deepEqual(recordedFailures, [
      { ip: "198.51.100.5", email: "staff@example.com" },
      { ip: "198.51.100.6", email: "other@example.com" },
    ]);
  });

  it("signs out and throws 403 ACCOUNT_INACTIVE when profile is inactive or missing", async () => {
    let resetCalled = false;
    const rateLimiter: LoginRateLimiter = {
      check: () => ({ allowed: true }),
      recordFailure: () => {
        throw new Error("should not record failure");
      },
      reset: () => {
        resetCalled = true;
      },
    };

    const { client: authClientInactive, signOutCalls: inactiveSignOutCalls } =
      fakeAuthClient({
        signInWithPassword: async () => ({
          data: { user: { id: RECEPTIONIST_ID } },
          error: null,
        }),
      });
    const { client: inactiveAdminClient } = fakeAdminClient({
      admin_profiles: [makeAdminProfileRow({ is_active: false })],
      clinics: [makeClinicRow()],
    });

    await assert.rejects(
      () =>
        loginStaff(
          {
            supabaseClient: authClientInactive,
            adminClient: inactiveAdminClient,
            rateLimiter,
          },
          { email: "receptionist@example.com", password: "correct" },
          "203.0.113.20",
        ),
      (err: unknown) =>
        err instanceof AuthServiceError &&
        err.status === 403 &&
        err.code === "ACCOUNT_INACTIVE" &&
        err.message === "الحساب ده غير نشط حالياً. تواصل مع إدارة المنصة.",
    );
    assert.equal(inactiveSignOutCalls.length, 1);
    assert.equal(resetCalled, false);

    const { client: authClientMissing, signOutCalls: missingSignOutCalls } =
      fakeAuthClient({
        signInWithPassword: async () => ({
          data: { user: { id: RECEPTIONIST_ID } },
          error: null,
        }),
      });
    const { client: missingAdminClient } = fakeAdminClient({
      admin_profiles: [],
      clinics: [],
    });

    await assert.rejects(
      () =>
        loginStaff(
          {
            supabaseClient: authClientMissing,
            adminClient: missingAdminClient,
            rateLimiter,
          },
          { email: "missing@example.com", password: "correct" },
          "203.0.113.20",
        ),
      (err: unknown) =>
        err instanceof AuthServiceError &&
        err.status === 403 &&
        err.code === "ACCOUNT_INACTIVE",
    );
    assert.equal(missingSignOutCalls.length, 1);
    assert.equal(resetCalled, false);
  });
});

describe("logoutStaff", () => {
  it("completes with global signOut when it succeeds", async () => {
    const { client, signOutCalls } = fakeAuthClient({
      signOut: async () => ({ error: null }),
    });

    await logoutStaff(client);

    assert.deepEqual(signOutCalls, [{ scope: "global" }]);
  });

  it("falls back to local signOut when global signOut returns an error", async () => {
    const { client, signOutCalls } = fakeAuthClient({
      signOut: async (options) =>
        options?.scope === "global"
          ? { error: { message: "Session already expired" } }
          : { error: null },
    });

    await logoutStaff(client);

    assert.deepEqual(signOutCalls, [{ scope: "global" }, { scope: "local" }]);
  });

  it("falls back to local signOut when global signOut throws", async () => {
    const { client, signOutCalls } = fakeAuthClient({
      signOut: async (options) => {
        if (options?.scope === "global") {
          throw new Error("Network failure");
        }
        return { error: null };
      },
    });

    await logoutStaff(client);

    assert.deepEqual(signOutCalls, [{ scope: "global" }, { scope: "local" }]);
  });
});

describe("assertRole", () => {
  it("throws 401 UNAUTHORIZED when profile is null", () => {
    assert.throws(
      () => assertRole(null),
      (err: unknown) =>
        err instanceof AuthServiceError &&
        err.status === 401 &&
        err.code === "UNAUTHORIZED",
    );
  });

  it("throws 403 ACCOUNT_INACTIVE when profile is inactive", () => {
    assert.throws(
      () => assertRole(makeStaffProfile({ isActive: false })),
      (err: unknown) =>
        err instanceof AuthServiceError &&
        err.status === 403 &&
        err.code === "ACCOUNT_INACTIVE",
    );
  });

  it("throws 403 FORBIDDEN when role is not in allowedRoles", () => {
    assert.throws(
      () => assertRole(makeStaffProfile({ role: "RECEPTIONIST" }), ["OWNER"]),
      (err: unknown) =>
        err instanceof AuthServiceError &&
        err.status === 403 &&
        err.code === "FORBIDDEN",
    );
  });

  it("returns profile when active and allowed", () => {
    const receptionist = makeStaffProfile({ role: "RECEPTIONIST" });
    assert.equal(assertRole(receptionist), receptionist);
    assert.equal(
      assertRole(receptionist, ["OWNER", "RECEPTIONIST"]),
      receptionist,
    );
  });
});

describe("assertClinicAccess", () => {
  it("allows OWNER to access any clinicId", () => {
    const owner = makeStaffProfile({
      id: OWNER_ID,
      role: "OWNER",
      clinicId: null,
      clinicName: null,
    });

    assert.doesNotThrow(() => assertClinicAccess(owner, CLINIC_ID));
    assert.doesNotThrow(() => assertClinicAccess(owner, OTHER_CLINIC_ID));
  });

  it("allows RECEPTIONIST to access their assigned clinicId", () => {
    const receptionist = makeStaffProfile({
      role: "RECEPTIONIST",
      clinicId: CLINIC_ID,
    });

    assert.doesNotThrow(() => assertClinicAccess(receptionist, CLINIC_ID));
  });

  it("blocks RECEPTIONIST from accessing another clinicId or when clinicId is null", () => {
    const receptionist = makeStaffProfile({
      role: "RECEPTIONIST",
      clinicId: CLINIC_ID,
    });
    const unassignedReceptionist = makeStaffProfile({
      role: "RECEPTIONIST",
      clinicId: null,
    });

    assert.throws(
      () => assertClinicAccess(receptionist, OTHER_CLINIC_ID),
      (err: unknown) =>
        err instanceof AuthServiceError &&
        err.status === 403 &&
        err.code === "FORBIDDEN",
    );

    assert.throws(
      () => assertClinicAccess(unassignedReceptionist, CLINIC_ID),
      (err: unknown) =>
        err instanceof AuthServiceError &&
        err.status === 403 &&
        err.code === "FORBIDDEN",
    );
  });
});

describe("toAuthErrorResponse", () => {
  it("maps 400 VALIDATION_ERROR with fieldErrors", async () => {
    const err = new AuthServiceError(
      400,
      "VALIDATION_ERROR",
      "اكتب البريد الإلكتروني",
      { fieldErrors: { email: "اكتب البريد الإلكتروني" } },
    );

    const response = toAuthErrorResponse(err);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("retry-after"), null);
    assert.deepEqual((await response.json()) as AuthErrorResponse, {
      error: "اكتب البريد الإلكتروني",
      code: "VALIDATION_ERROR",
      fieldErrors: { email: "اكتب البريد الإلكتروني" },
    });
  });

  it("maps 401 and 403 AuthServiceError responses", async () => {
    const unauthorized = toAuthErrorResponse(
      new AuthServiceError(401, "UNAUTHORIZED", "لازم تسجل دخول الأول."),
    );
    assert.equal(unauthorized.status, 401);
    assert.deepEqual((await unauthorized.json()) as AuthErrorResponse, {
      error: "لازم تسجل دخول الأول.",
      code: "UNAUTHORIZED",
    });

    const forbidden = toAuthErrorResponse(
      new AuthServiceError(403, "FORBIDDEN", "معندكش صلاحية تدخل هنا."),
    );
    assert.equal(forbidden.status, 403);
    assert.deepEqual((await forbidden.json()) as AuthErrorResponse, {
      error: "معندكش صلاحية تدخل هنا.",
      code: "FORBIDDEN",
    });
  });

  it("maps 429 RATE_LIMITED with retryAfterSeconds body and Retry-After header", async () => {
    const response = toAuthErrorResponse(
      new AuthServiceError(
        429,
        "RATE_LIMITED",
        "جربت كتير تدخل بحساب غلط، استنى شوية وحاول تاني.",
        { retryAfterSeconds: 95 },
      ),
    );

    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "95");
    assert.deepEqual((await response.json()) as AuthErrorResponse, {
      error: "جربت كتير تدخل بحساب غلط، استنى شوية وحاول تاني.",
      code: "RATE_LIMITED",
      retryAfterSeconds: 95,
    });
  });

  it("maps unknown errors to 500 INTERNAL_ERROR without leaking details", async () => {
    const response = toAuthErrorResponse(new Error("secret internal trace"));

    assert.equal(response.status, 500);
    assert.deepEqual((await response.json()) as AuthErrorResponse, {
      error: "حصلت مشكلة في الخادم، حاول تاني بعد شوية.",
      code: "INTERNAL_ERROR",
    });
  });
});
