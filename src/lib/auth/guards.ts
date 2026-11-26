import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getDefaultDashboardPath } from "@/lib/validations/auth";
import {
  AuthServiceError,
  assertRole,
  getCurrentStaffSession,
} from "@/services/auth";
import type { AuthErrorResponse, StaffProfile } from "@/types/auth";
import type { AdminRole } from "@/types/database";

const INTERNAL_SERVER_ERROR_MESSAGE =
  "حصلت مشكلة في الخادم، حاول تاني بعد شوية.";

/**
 * Reads the current authenticated and active staff profile for the request,
 * returning `null` for unauthenticated visitors or inactive accounts.
 */
export async function getOptionalStaffSession(): Promise<StaffProfile | null> {
  await connection();
  const supabaseClient = await createClient();
  const adminClient = createAdminClient();
  return getCurrentStaffSession(supabaseClient, adminClient);
}

/**
 * Guards an Owner-only Server Component page, redirecting unauthenticated
 * visitors to `/login` and non-owner staff to their own dashboard.
 */
export async function requireOwnerPage(
  currentPath?: string,
): Promise<StaffProfile> {
  const session = await getOptionalStaffSession();
  if (!session) {
    redirect(
      currentPath ? `/login?next=${encodeURIComponent(currentPath)}` : "/login",
    );
  }

  if (session.role !== "OWNER") {
    redirect(getDefaultDashboardPath(session.role));
  }

  return session;
}

/**
 * Guards a Receptionist-only Server Component page, redirecting unauthenticated
 * visitors to `/login` and non-receptionist staff to their own dashboard.
 */
export async function requireReceptionistPage(
  currentPath?: string,
): Promise<StaffProfile> {
  const session = await getOptionalStaffSession();
  if (!session) {
    redirect(
      currentPath ? `/login?next=${encodeURIComponent(currentPath)}` : "/login",
    );
  }

  if (session.role !== "RECEPTIONIST") {
    redirect(getDefaultDashboardPath(session.role));
  }

  return session;
}

/**
 * Guards an admin/staff API Route Handler and returns the verified `StaffProfile`,
 * throwing `AuthServiceError` on missing session, inactive account, or role mismatch.
 */
export async function requireAdminApi(
  allowedRoles?: readonly AdminRole[],
): Promise<StaffProfile> {
  const session = await getOptionalStaffSession();
  return assertRole(session, allowedRoles);
}

/**
 * Converts an `AuthServiceError` or unexpected error into a JSON `Response`
 * matching `AuthErrorResponse`, attaching `Retry-After` on 429 responses.
 */
export function toAuthErrorResponse(error: unknown): Response {
  if (error instanceof AuthServiceError) {
    const body: AuthErrorResponse = {
      error: error.message,
      code: error.code,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      ...(error.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: error.retryAfterSeconds }
        : {}),
    };

    const headers =
      error.status === 429 && error.retryAfterSeconds !== undefined
        ? { "Retry-After": String(error.retryAfterSeconds) }
        : undefined;

    return Response.json(body, {
      status: error.status,
      ...(headers ? { headers } : {}),
    });
  }

  return Response.json(
    {
      error: INTERNAL_SERVER_ERROR_MESSAGE,
      code: "INTERNAL_ERROR",
    } satisfies AuthErrorResponse,
    { status: 500 },
  );
}
