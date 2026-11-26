import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAdminApi, toAuthErrorResponse } from "@/lib/auth/guards";
import {
  extractClientIp,
  loginRateLimiter,
  type LoginRateLimiter,
} from "@/lib/auth/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseLoginInput } from "@/lib/validations/auth";
import {
  AuthServiceError,
  assertClinicAccess,
  loginStaff,
  logoutStaff,
} from "@/services/auth";
import type { LoginResponse, StaffProfile } from "@/types/auth";
import type { AdminRole, Database } from "@/types/database";

const INVALID_LOGIN_JSON_MESSAGE = "بيانات الدخول مش مظبوطة، راجعها وحاول تاني.";

export interface LoginPostHandlerDeps {
  getSupabaseClient?: () =>
    | Promise<SupabaseClient<Database>>
    | SupabaseClient<Database>;
  getAdminClient?: () => SupabaseClient<Database>;
  rateLimiter?: LoginRateLimiter;
}

export interface LogoutPostHandlerDeps {
  getSupabaseClient?: () =>
    | Promise<SupabaseClient<Database>>
    | SupabaseClient<Database>;
}

export interface AdminMeGetHandlerDeps {
  requireAdmin?: (allowedRoles?: readonly AdminRole[]) => Promise<StaffProfile>;
}

/**
 * Serializes a JSON `Response` with `Cache-Control: no-store` enforced.
 */
export function noStoreJson(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, {
    ...init,
    headers,
  });
}

function toNoStoreAuthErrorResponse(error: unknown): Response {
  const response = toAuthErrorResponse(error);
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Creates the `POST /api/admin/login` handler with injectable dependencies for tests.
 */
export function createLoginPostHandler(
  deps: LoginPostHandlerDeps = {},
): (request: Request) => Promise<Response> {
  const getSupabaseClient = deps.getSupabaseClient ?? createClient;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;
  const rateLimiter = deps.rateLimiter ?? loginRateLimiter;

  return async function handleLoginPost(request: Request): Promise<Response> {
    try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        throw new AuthServiceError(
          400,
          "VALIDATION_ERROR",
          INVALID_LOGIN_JSON_MESSAGE,
        );
      }

      const parsed = parseLoginInput(body);
      if (!parsed.success) {
        throw new AuthServiceError(400, "VALIDATION_ERROR", parsed.message, {
          fieldErrors: parsed.fieldErrors,
        });
      }

      const supabaseClient = await getSupabaseClient();
      const adminClient = getAdminClient();
      const result = await loginStaff(
        {
          supabaseClient,
          adminClient,
          rateLimiter,
        },
        parsed.data,
        extractClientIp(request),
      );

      return noStoreJson(result satisfies LoginResponse, { status: 200 });
    } catch (error) {
      return toNoStoreAuthErrorResponse(error);
    }
  };
}

/**
 * Creates the `POST /api/admin/logout` handler with injectable dependencies for tests.
 */
export function createLogoutPostHandler(
  deps: LogoutPostHandlerDeps = {},
): () => Promise<Response> {
  const getSupabaseClient = deps.getSupabaseClient ?? createClient;

  return async function handleLogoutPost(): Promise<Response> {
    try {
      const supabaseClient = await getSupabaseClient();
      await logoutStaff(supabaseClient);
      return noStoreJson({ ok: true }, { status: 200 });
    } catch (error) {
      return toNoStoreAuthErrorResponse(error);
    }
  };
}

/**
 * Creates the `GET /api/owner/me` handler with injectable dependencies for tests.
 */
export function createOwnerMeGetHandler(
  deps: AdminMeGetHandlerDeps = {},
): () => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;

  return async function handleOwnerMeGet(): Promise<Response> {
    try {
      const user = await requireAdmin(["OWNER"]);
      return noStoreJson({ user }, { status: 200 });
    } catch (error) {
      return toNoStoreAuthErrorResponse(error);
    }
  };
}

/**
 * Creates the `GET /api/receptionist/me` handler with injectable dependencies for tests.
 */
export function createReceptionistMeGetHandler(
  deps: AdminMeGetHandlerDeps = {},
): (request: Request) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;

  return async function handleReceptionistMeGet(
    request: Request,
  ): Promise<Response> {
    try {
      const user = await requireAdmin(["RECEPTIONIST"]);
      const clinicId = new URL(request.url).searchParams.get("clinicId")?.trim();
      if (clinicId) {
        assertClinicAccess(user, clinicId);
      }

      return noStoreJson({ user }, { status: 200 });
    } catch (error) {
      return toNoStoreAuthErrorResponse(error);
    }
  };
}
