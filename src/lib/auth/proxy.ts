import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicEnv } from "@/lib/supabase/env";
import {
  getDefaultDashboardPath,
  sanitizeRedirectPath,
} from "@/lib/validations/auth";
import type { AuthErrorResponse } from "@/types/auth";
import type { AdminRole, Database } from "@/types/database";

const UNAUTHORIZED_ERROR = "لازم تسجل دخول الأول.";
const ACCOUNT_INACTIVE_ERROR = "الحساب ده غير نشط حالياً.";
const FORBIDDEN_ERROR = "معندكش صلاحية تدخل هنا.";

export interface ProxyUser {
  id: string;
}

export interface ProxyProfileRecord {
  role: AdminRole;
  clinicId: string | null;
  isActive: boolean;
}

export interface ProxyCookieEntry {
  name: string;
  value: string;
  options?: CookieOptions;
}

export interface ProxyCookieStore {
  getAll: () => ReturnType<NextRequest["cookies"]["getAll"]>;
  setAll: (
    cookiesToSet: ProxyCookieEntry[],
    headers?: Record<string, string>,
  ) => void;
  createNextResponse: () => NextResponse;
  applyToResponse: (response: NextResponse) => NextResponse;
}

export interface ProxyAuthDeps {
  getUser: () => Promise<ProxyUser | null>;
  getProfileByUserId: (userId: string) => Promise<ProxyProfileRecord | null>;
  createNextResponse?: () => NextResponse;
  applyCookies: (response: NextResponse) => NextResponse;
}

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function createJsonErrorResponse(
  status: 401 | 403,
  body: AuthErrorResponse,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Tracks refreshed Supabase auth cookies and anti-cache headers on a request
 * so they are applied to both `NextResponse.next` and redirect/JSON responses.
 */
export function createProxyCookieStore(request: NextRequest): ProxyCookieStore {
  const pendingCookies = new Map<string, ProxyCookieEntry>();
  const pendingHeaders = new Map<string, string>();

  return {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet, headers) {
      for (const { name, value, options } of cookiesToSet) {
        request.cookies.set(name, value);
        pendingCookies.set(name, { name, value, options });
      }

      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          pendingHeaders.set(key, value);
        }
      }
    },
    createNextResponse() {
      return NextResponse.next({ request });
    },
    applyToResponse(response) {
      for (const { name, value, options } of pendingCookies.values()) {
        response.cookies.set(name, value, options);
      }

      for (const [key, value] of pendingHeaders.entries()) {
        // Keep explicit response headers (such as Cache-Control: no-store on 401/403).
        if (!response.headers.has(key)) {
          response.headers.set(key, value);
        }
      }

      return response;
    },
  };
}

/**
 * Builds Supabase-backed proxy dependencies using only the public anon/publishable key.
 */
export function createSupabaseProxyDeps(request: NextRequest): ProxyAuthDeps {
  const { url, publishableKey } = getSupabasePublicEnv();
  const cookieStore = createProxyCookieStore(request);

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet, headers) => cookieStore.setAll(cookiesToSet, headers),
    },
  });

  return {
    async getUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        return null;
      }

      return { id: data.user.id };
    },
    async getProfileByUserId(userId) {
      const { data, error } = await supabase
        .from("admin_profiles")
        .select("role, clinic_id, is_active")
        .eq("id", userId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return {
        role: data.role,
        clinicId: data.clinic_id,
        isActive: data.is_active,
      };
    },
    createNextResponse: () => cookieStore.createNextResponse(),
    applyCookies: (response) => cookieStore.applyToResponse(response),
  };
}

/**
 * Enforces staff authentication, account status, and role isolation in Next.js Proxy
 * while preserving any refreshed Supabase auth cookies on the returned response.
 */
export async function handleAuthProxy(
  request: NextRequest,
  deps: ProxyAuthDeps,
): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  const isLoginPage = pathname === "/login" || pathname === "/login/";
  const isOwnerApi = matchesPathPrefix(pathname, "/api/owner");
  const isReceptionistApi = matchesPathPrefix(pathname, "/api/receptionist");
  const isProtectedApi = isOwnerApi || isReceptionistApi;
  const isOwnerPage = matchesPathPrefix(pathname, "/owner");
  const isReceptionistPage = matchesPathPrefix(pathname, "/receptionist");
  const isProtectedPage = isOwnerPage || isReceptionistPage;

  const createNext = () =>
    deps.createNextResponse
      ? deps.createNextResponse()
      : NextResponse.next({ request });

  if (!isLoginPage && !isProtectedApi && !isProtectedPage) {
    return deps.applyCookies(createNext());
  }

  const user = await deps.getUser();

  if (!user) {
    if (isProtectedApi) {
      return deps.applyCookies(
        createJsonErrorResponse(401, {
          error: UNAUTHORIZED_ERROR,
          code: "UNAUTHORIZED",
        }),
      );
    }

    if (isProtectedPage) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${search}`);
      return deps.applyCookies(NextResponse.redirect(loginUrl));
    }

    return deps.applyCookies(createNext());
  }

  const profile = await deps.getProfileByUserId(user.id);

  if (!profile || !profile.isActive) {
    if (isProtectedApi) {
      return deps.applyCookies(
        createJsonErrorResponse(403, {
          error: ACCOUNT_INACTIVE_ERROR,
          code: "ACCOUNT_INACTIVE",
        }),
      );
    }

    if (isProtectedPage) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("reason", "inactive");
      return deps.applyCookies(NextResponse.redirect(loginUrl));
    }

    // Never redirect /login to /login?reason=inactive to avoid redirect loops.
    return deps.applyCookies(createNext());
  }

  if (isLoginPage) {
    const redirectPath = sanitizeRedirectPath(
      request.nextUrl.searchParams.get("next"),
      profile.role,
    );
    return deps.applyCookies(
      NextResponse.redirect(new URL(redirectPath, request.url)),
    );
  }

  const isOwnerRoute = isOwnerPage || isOwnerApi;
  const isReceptionistRoute = isReceptionistPage || isReceptionistApi;
  const isCrossRole =
    (isOwnerRoute && profile.role !== "OWNER") ||
    (isReceptionistRoute && profile.role !== "RECEPTIONIST");

  if (isCrossRole) {
    if (isProtectedApi) {
      return deps.applyCookies(
        createJsonErrorResponse(403, {
          error: FORBIDDEN_ERROR,
          code: "FORBIDDEN",
        }),
      );
    }

    const dashboardPath = getDefaultDashboardPath(profile.role);
    return deps.applyCookies(
      NextResponse.redirect(new URL(dashboardPath, request.url)),
    );
  }

  return deps.applyCookies(createNext());
}
