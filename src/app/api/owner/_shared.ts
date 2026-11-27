import { noStoreJson } from "@/app/api/admin/_shared";
import { toAuthErrorResponse } from "@/lib/auth/guards";
import { parseUuidParam } from "@/lib/validations/owner";
import { AuthServiceError } from "@/services/auth";
import { OwnerServiceError } from "@/services/owner-errors";
import type { OwnerErrorResponse } from "@/types/owner";

const INVALID_JSON_MESSAGE = "البيانات المبعوتة مش مظبوطة، راجعها وحاول تاني.";
const INTERNAL_SERVER_ERROR_MESSAGE =
  "حصلت مشكلة في الخادم، حاول تاني بعد شوية.";

/**
 * Serializes an owner API JSON response with `Cache-Control: no-store`.
 */
export function ownerJson(body: unknown, init?: ResponseInit): Response {
  return noStoreJson(body, init);
}

/**
 * Converts `AuthServiceError`, `OwnerServiceError`, or unexpected errors into
 * a localized JSON `Response` with `Cache-Control: no-store`.
 */
export function toOwnerErrorResponse(error: unknown): Response {
  if (error instanceof AuthServiceError) {
    const response = toAuthErrorResponse(error);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  if (error instanceof OwnerServiceError) {
    const hasFieldErrors =
      error.fieldErrors !== undefined &&
      Object.keys(error.fieldErrors).length > 0;

    const body: OwnerErrorResponse = {
      error: error.message,
      code: error.code,
      ...(hasFieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    };

    return ownerJson(body, { status: error.status });
  }

  return ownerJson(
    {
      error: INTERNAL_SERVER_ERROR_MESSAGE,
      code: "INTERNAL_ERROR",
    } satisfies OwnerErrorResponse,
    { status: 500 },
  );
}

/**
 * Parses a JSON request body or throws a localized 400 `OwnerServiceError`.
 */
export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new OwnerServiceError(400, "VALIDATION_ERROR", INVALID_JSON_MESSAGE);
  }
}

/**
 * Validates a route UUID parameter or throws a localized 400 `OwnerServiceError`.
 */
export function requireUuidOrThrow(rawId: string, label?: string): string {
  const parsed = parseUuidParam(rawId, label);
  if (!parsed.success) {
    throw new OwnerServiceError(400, "VALIDATION_ERROR", parsed.message);
  }
  return parsed.id;
}
