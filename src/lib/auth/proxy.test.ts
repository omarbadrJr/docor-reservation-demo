import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import { config as proxyConfig } from "@/proxy";

import {
  createProxyCookieStore,
  handleAuthProxy,
  type ProxyAuthDeps,
  type ProxyProfileRecord,
  type ProxyUser,
} from "./proxy";

const ORIGIN = "https://clinic.example";

function makeRequest(pathWithQuery: string, cookieHeader?: string): NextRequest {
  const headers = new Headers();
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }
  return new NextRequest(`${ORIGIN}${pathWithQuery}`, { headers });
}

function createDeps(
  request: NextRequest,
  options: {
    user?: ProxyUser | null;
    profile?: ProxyProfileRecord | null;
    onGetUser?: (cookieStore: ReturnType<typeof createProxyCookieStore>) => void;
    onGetProfile?: (userId: string) => void;
  } = {},
): ProxyAuthDeps {
  const cookieStore = createProxyCookieStore(request);

  return {
    async getUser() {
      options.onGetUser?.(cookieStore);
      return options.user ?? null;
    },
    async getProfileByUserId(userId) {
      options.onGetProfile?.(userId);
      return options.profile ?? null;
    },
    createNextResponse: () => cookieStore.createNextResponse(),
    applyCookies: (response) => cookieStore.applyToResponse(response),
  };
}

describe("proxy config", () => {
  it("targets login, staff dashboards, and staff API routes", () => {
    assert.deepEqual(proxyConfig, {
      matcher: [
        "/login",
        "/owner/:path*",
        "/receptionist/:path*",
        "/api/owner/:path*",
        "/api/receptionist/:path*",
      ],
    });
  });
});

describe("handleAuthProxy — unauthenticated requests", () => {
  it("returns 401 UNAUTHORIZED with no-store on protected API routes", async () => {
    for (const path of ["/api/owner/doctors", "/api/receptionist/appointments"]) {
      let profileLookedUp = false;
      const request = makeRequest(path);
      const response = await handleAuthProxy(
        request,
        createDeps(request, {
          user: null,
          onGetProfile: () => {
            profileLookedUp = true;
          },
        }),
      );

      assert.equal(profileLookedUp, false);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), {
        error: "لازم تسجل دخول الأول.",
        code: "UNAUTHORIZED",
      });
    }
  });

  it("redirects unauthenticated dashboard requests to /login?next=...", async () => {
    const ownerReq = makeRequest("/owner/doctors?status=active");
    const ownerRes = await handleAuthProxy(
      ownerReq,
      createDeps(ownerReq, { user: null }),
    );
    assert.equal(ownerRes.status, 307);
    assert.equal(
      ownerRes.headers.get("location"),
      `${ORIGIN}/login?next=%2Fowner%2Fdoctors%3Fstatus%3Dactive`,
    );

    const recReq = makeRequest("/receptionist");
    const recRes = await handleAuthProxy(
      recReq,
      createDeps(recReq, { user: null }),
    );
    assert.equal(recRes.status, 307);
    assert.equal(
      recRes.headers.get("location"),
      `${ORIGIN}/login?next=%2Freceptionist`,
    );
  });

  it("passes through unauthenticated /login requests", async () => {
    const request = makeRequest("/login");
    const response = await handleAuthProxy(
      request,
      createDeps(request, { user: null }),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(response.headers.get("location"), null);
  });
});

describe("handleAuthProxy — authenticated active staff on /login", () => {
  it("redirects active staff without ?next to their role dashboard", async () => {
    const ownerReq = makeRequest("/login");
    const ownerRes = await handleAuthProxy(
      ownerReq,
      createDeps(ownerReq, {
        user: { id: "owner-1" },
        profile: { role: "OWNER", clinicId: null, isActive: true },
      }),
    );
    assert.equal(ownerRes.status, 307);
    assert.equal(ownerRes.headers.get("location"), `${ORIGIN}/owner`);

    const recReq = makeRequest("/login");
    const recRes = await handleAuthProxy(
      recReq,
      createDeps(recReq, {
        user: { id: "rec-1" },
        profile: { role: "RECEPTIONIST", clinicId: "clinic-1", isActive: true },
      }),
    );
    assert.equal(recRes.status, 307);
    assert.equal(recRes.headers.get("location"), `${ORIGIN}/receptionist`);
  });

  it("honors same-role ?next and falls back on cross-role or unsafe ?next", async () => {
    const validOwnerReq = makeRequest(
      "/login?next=%2Fowner%2Fclinics%3Ftab%3D2",
    );
    const validOwnerRes = await handleAuthProxy(
      validOwnerReq,
      createDeps(validOwnerReq, {
        user: { id: "owner-1" },
        profile: { role: "OWNER", clinicId: null, isActive: true },
      }),
    );
    assert.equal(validOwnerRes.status, 307);
    assert.equal(
      validOwnerRes.headers.get("location"),
      `${ORIGIN}/owner/clinics?tab=2`,
    );

    const validRecReq = makeRequest("/login?next=%2Freceptionist%2Fcheck-in");
    const validRecRes = await handleAuthProxy(
      validRecReq,
      createDeps(validRecReq, {
        user: { id: "rec-1" },
        profile: { role: "RECEPTIONIST", clinicId: "clinic-1", isActive: true },
      }),
    );
    assert.equal(validRecRes.status, 307);
    assert.equal(
      validRecRes.headers.get("location"),
      `${ORIGIN}/receptionist/check-in`,
    );

    const crossOwnerReq = makeRequest("/login?next=%2Freceptionist");
    const crossOwnerRes = await handleAuthProxy(
      crossOwnerReq,
      createDeps(crossOwnerReq, {
        user: { id: "owner-1" },
        profile: { role: "OWNER", clinicId: null, isActive: true },
      }),
    );
    assert.equal(crossOwnerRes.status, 307);
    assert.equal(crossOwnerRes.headers.get("location"), `${ORIGIN}/owner`);

    const crossRecReq = makeRequest("/login?next=%2Fowner%2Fdoctors");
    const crossRecRes = await handleAuthProxy(
      crossRecReq,
      createDeps(crossRecReq, {
        user: { id: "rec-1" },
        profile: { role: "RECEPTIONIST", clinicId: "clinic-1", isActive: true },
      }),
    );
    assert.equal(crossRecRes.status, 307);
    assert.equal(crossRecRes.headers.get("location"), `${ORIGIN}/receptionist`);

    const unsafeReq = makeRequest("/login?next=https%3A%2F%2Fevil.example%2Fowner");
    const unsafeRes = await handleAuthProxy(
      unsafeReq,
      createDeps(unsafeReq, {
        user: { id: "owner-1" },
        profile: { role: "OWNER", clinicId: null, isActive: true },
      }),
    );
    assert.equal(unsafeRes.status, 307);
    assert.equal(unsafeRes.headers.get("location"), `${ORIGIN}/owner`);
  });
});

describe("handleAuthProxy — missing or inactive profile", () => {
  it("redirects dashboard access to /login?reason=inactive", async () => {
    const inactiveOwnerReq = makeRequest("/owner");
    const inactiveOwnerRes = await handleAuthProxy(
      inactiveOwnerReq,
      createDeps(inactiveOwnerReq, {
        user: { id: "owner-inactive" },
        profile: { role: "OWNER", clinicId: null, isActive: false },
      }),
    );
    assert.equal(inactiveOwnerRes.status, 307);
    assert.equal(
      inactiveOwnerRes.headers.get("location"),
      `${ORIGIN}/login?reason=inactive`,
    );

    const missingRecReq = makeRequest("/receptionist/today");
    const missingRecRes = await handleAuthProxy(
      missingRecReq,
      createDeps(missingRecReq, {
        user: { id: "rec-missing" },
        profile: null,
      }),
    );
    assert.equal(missingRecRes.status, 307);
    assert.equal(
      missingRecRes.headers.get("location"),
      `${ORIGIN}/login?reason=inactive`,
    );
  });

  it("stays on /login without a redirect loop when profile is inactive or missing", async () => {
    const inactiveLoginReq = makeRequest("/login");
    const inactiveLoginRes = await handleAuthProxy(
      inactiveLoginReq,
      createDeps(inactiveLoginReq, {
        user: { id: "owner-inactive" },
        profile: { role: "OWNER", clinicId: null, isActive: false },
      }),
    );
    assert.equal(inactiveLoginRes.status, 200);
    assert.equal(inactiveLoginRes.headers.get("x-middleware-next"), "1");
    assert.equal(inactiveLoginRes.headers.get("location"), null);

    const missingLoginReq = makeRequest("/login?reason=inactive");
    const missingLoginRes = await handleAuthProxy(
      missingLoginReq,
      createDeps(missingLoginReq, {
        user: { id: "rec-missing" },
        profile: null,
      }),
    );
    assert.equal(missingLoginRes.status, 200);
    assert.equal(missingLoginRes.headers.get("x-middleware-next"), "1");
    assert.equal(missingLoginRes.headers.get("location"), null);
  });

  it("returns 403 ACCOUNT_INACTIVE with no-store on protected API routes", async () => {
    const request = makeRequest("/api/owner/doctors");
    const response = await handleAuthProxy(
      request,
      createDeps(request, {
        user: { id: "owner-inactive" },
        profile: { role: "OWNER", clinicId: null, isActive: false },
      }),
    );

    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      error: "الحساب ده غير نشط حالياً.",
      code: "ACCOUNT_INACTIVE",
    });

    const missingApiReq = makeRequest("/api/receptionist/appointments");
    const missingApiRes = await handleAuthProxy(
      missingApiReq,
      createDeps(missingApiReq, {
        user: { id: "rec-missing" },
        profile: null,
      }),
    );

    assert.equal(missingApiRes.status, 403);
    assert.equal(missingApiRes.headers.get("cache-control"), "no-store");
    assert.deepEqual(await missingApiRes.json(), {
      error: "الحساب ده غير نشط حالياً.",
      code: "ACCOUNT_INACTIVE",
    });
  });
});

describe("handleAuthProxy — cross-role and matching-role access", () => {
  it("redirects cross-role dashboard access to the user's own dashboard", async () => {
    const recToOwnerReq = makeRequest("/owner/doctors");
    const recToOwnerRes = await handleAuthProxy(
      recToOwnerReq,
      createDeps(recToOwnerReq, {
        user: { id: "rec-1" },
        profile: { role: "RECEPTIONIST", clinicId: "clinic-1", isActive: true },
      }),
    );
    assert.equal(recToOwnerRes.status, 307);
    assert.equal(recToOwnerRes.headers.get("location"), `${ORIGIN}/receptionist`);

    const ownerToRecReq = makeRequest("/receptionist/check-in");
    const ownerToRecRes = await handleAuthProxy(
      ownerToRecReq,
      createDeps(ownerToRecReq, {
        user: { id: "owner-1" },
        profile: { role: "OWNER", clinicId: null, isActive: true },
      }),
    );
    assert.equal(ownerToRecRes.status, 307);
    assert.equal(ownerToRecRes.headers.get("location"), `${ORIGIN}/owner`);
  });

  it("returns 403 FORBIDDEN with no-store on cross-role API requests", async () => {
    const recToOwnerApiReq = makeRequest("/api/owner/clinics");
    const recToOwnerApiRes = await handleAuthProxy(
      recToOwnerApiReq,
      createDeps(recToOwnerApiReq, {
        user: { id: "rec-1" },
        profile: { role: "RECEPTIONIST", clinicId: "clinic-1", isActive: true },
      }),
    );
    assert.equal(recToOwnerApiRes.status, 403);
    assert.equal(recToOwnerApiRes.headers.get("cache-control"), "no-store");
    assert.deepEqual(await recToOwnerApiRes.json(), {
      error: "معندكش صلاحية تدخل هنا.",
      code: "FORBIDDEN",
    });

    const ownerToRecApiReq = makeRequest("/api/receptionist/appointments");
    const ownerToRecApiRes = await handleAuthProxy(
      ownerToRecApiReq,
      createDeps(ownerToRecApiReq, {
        user: { id: "owner-1" },
        profile: { role: "OWNER", clinicId: null, isActive: true },
      }),
    );
    assert.equal(ownerToRecApiRes.status, 403);
    assert.equal(ownerToRecApiRes.headers.get("cache-control"), "no-store");
    assert.deepEqual(await ownerToRecApiRes.json(), {
      error: "معندكش صلاحية تدخل هنا.",
      code: "FORBIDDEN",
    });
  });

  it("allows matching-role dashboard and API requests to proceed", async () => {
    const cases: Array<{ path: string; profile: ProxyProfileRecord }> = [
      {
        path: "/owner/doctors",
        profile: { role: "OWNER", clinicId: null, isActive: true },
      },
      {
        path: "/api/owner/doctors",
        profile: { role: "OWNER", clinicId: null, isActive: true },
      },
      {
        path: "/receptionist",
        profile: { role: "RECEPTIONIST", clinicId: "clinic-1", isActive: true },
      },
      {
        path: "/api/receptionist/appointments",
        profile: { role: "RECEPTIONIST", clinicId: "clinic-1", isActive: true },
      },
    ];

    for (const testCase of cases) {
      const request = makeRequest(testCase.path);
      const response = await handleAuthProxy(
        request,
        createDeps(request, {
          user: { id: "staff-1" },
          profile: testCase.profile,
        }),
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-middleware-next"), "1");
    }
  });
});

describe("createProxyCookieStore — refreshed auth cookies preservation", () => {
  const simulateTokenRefresh = (
    cookieStore: ReturnType<typeof createProxyCookieStore>,
  ) => {
    cookieStore.setAll(
      [
        {
          name: "sb-project-auth-token",
          value: "refreshed-jwt-token",
          options: {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            maxAge: 3600,
          },
        },
      ],
      {
        "Cache-Control":
          "private, no-cache, no-store, must-revalidate, max-age=0",
      },
    );
  };

  it("preserves refreshed cookies and headers on NextResponse.next()", async () => {
    const request = makeRequest(
      "/owner",
      "sb-project-auth-token=stale-jwt-token",
    );

    const response = await handleAuthProxy(
      request,
      createDeps(request, {
        user: { id: "owner-1" },
        profile: { role: "OWNER", clinicId: null, isActive: true },
        onGetUser: simulateTokenRefresh,
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(
      request.cookies.get("sb-project-auth-token")?.value,
      "refreshed-jwt-token",
    );
    const responseCookie = response.cookies.get("sb-project-auth-token");
    assert.ok(responseCookie);
    assert.equal(responseCookie.name, "sb-project-auth-token");
    assert.equal(responseCookie.value, "refreshed-jwt-token");
    assert.equal(responseCookie.path, "/");
    assert.equal(responseCookie.httpOnly, true);
    assert.equal(responseCookie.sameSite, "lax");
    assert.equal(responseCookie.maxAge, 3600);
    assert.ok(responseCookie.expires instanceof Date);
    assert.equal(
      response.headers.get("cache-control"),
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
  });

  it("preserves refreshed cookies on redirect responses", async () => {
    const loginRedirectReq = makeRequest(
      "/login",
      "sb-project-auth-token=stale-jwt-token",
    );
    const loginRedirectRes = await handleAuthProxy(
      loginRedirectReq,
      createDeps(loginRedirectReq, {
        user: { id: "owner-1" },
        profile: { role: "OWNER", clinicId: null, isActive: true },
        onGetUser: simulateTokenRefresh,
      }),
    );

    assert.equal(loginRedirectRes.status, 307);
    assert.equal(loginRedirectRes.headers.get("location"), `${ORIGIN}/owner`);
    assert.equal(
      loginRedirectRes.cookies.get("sb-project-auth-token")?.value,
      "refreshed-jwt-token",
    );

    const crossRoleRedirectReq = makeRequest(
      "/owner/doctors",
      "sb-project-auth-token=stale-jwt-token",
    );
    const crossRoleRedirectRes = await handleAuthProxy(
      crossRoleRedirectReq,
      createDeps(crossRoleRedirectReq, {
        user: { id: "rec-1" },
        profile: { role: "RECEPTIONIST", clinicId: "clinic-1", isActive: true },
        onGetUser: simulateTokenRefresh,
      }),
    );

    assert.equal(crossRoleRedirectRes.status, 307);
    assert.equal(
      crossRoleRedirectRes.headers.get("location"),
      `${ORIGIN}/receptionist`,
    );
    assert.equal(
      crossRoleRedirectRes.cookies.get("sb-project-auth-token")?.value,
      "refreshed-jwt-token",
    );

    const inactiveRedirectReq = makeRequest(
      "/owner",
      "sb-project-auth-token=stale-jwt-token",
    );
    const inactiveRedirectRes = await handleAuthProxy(
      inactiveRedirectReq,
      createDeps(inactiveRedirectReq, {
        user: { id: "owner-inactive" },
        profile: { role: "OWNER", clinicId: null, isActive: false },
        onGetUser: simulateTokenRefresh,
      }),
    );

    assert.equal(inactiveRedirectRes.status, 307);
    assert.equal(
      inactiveRedirectRes.headers.get("location"),
      `${ORIGIN}/login?reason=inactive`,
    );
    assert.equal(
      inactiveRedirectRes.cookies.get("sb-project-auth-token")?.value,
      "refreshed-jwt-token",
    );
  });

  it("preserves refreshed cookies and explicit Cache-Control: no-store on JSON error responses", async () => {
    const request = makeRequest(
      "/api/owner/doctors",
      "sb-project-auth-token=stale-jwt-token",
    );

    const response = await handleAuthProxy(
      request,
      createDeps(request, {
        user: { id: "rec-1" },
        profile: { role: "RECEPTIONIST", clinicId: "clinic-1", isActive: true },
        onGetUser: simulateTokenRefresh,
      }),
    );

    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(
      response.cookies.get("sb-project-auth-token")?.value,
      "refreshed-jwt-token",
    );
  });
});
