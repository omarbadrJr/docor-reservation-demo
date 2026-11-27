import { noStoreJson } from "@/app/api/admin/_shared";
import { toAuthErrorResponse } from "@/lib/auth/guards";
import { AuthServiceError } from "@/services/auth";
import { ReceptionistServiceError } from "@/services/receptionist-errors";
import type { ReceptionistErrorResponse } from "@/types/receptionist";

const INVALID_JSON_MESSAGE = "البيانات المبعوتة مش مظبوطة، راجعها وحاول تاني.";
const INTERNAL_SERVER_ERROR_MESSAGE =
  "حصلت مشكلة في الخادم، حاول تاني بعد شوية.";

/**
 * Serializes a receptionist API JSON response with `Cache-Control: no-store`.
 */
export function receptionistJson(body: unknown, init?: ResponseInit): Response {
  return noStoreJson(body, init);
}

/**
 * Converts `AuthServiceError`, `ReceptionistServiceError`, or unexpected errors
 * into a localized JSON `Response` with `Cache-Control: no-store`.
 */
export function toReceptionistErrorResponse(error: unknown): Response {
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

  if (error instanceof ReceptionistServiceError) {
    const hasFieldErrors =
      error.fieldErrors !== undefined &&
      Object.keys(error.fieldErrors).length > 0;

    const body: ReceptionistErrorResponse = {
      error: error.message,
      code: error.code,
      ...(hasFieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    };

    return receptionistJson(body, { status: error.status });
  }

  return receptionistJson(
    {
      error: INTERNAL_SERVER_ERROR_MESSAGE,
      code: "INTERNAL_ERROR",
    } satisfies ReceptionistErrorResponse,
    { status: 500 },
  );
}

/**
 * Parses a JSON request body or throws a localized 400 `ReceptionistServiceError`.
 */
export async function parseReceptionistJsonBody(
  request: Request,
): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ReceptionistServiceError(
      400,
      "VALIDATION_ERROR",
      INVALID_JSON_MESSAGE,
    );
  }
}
