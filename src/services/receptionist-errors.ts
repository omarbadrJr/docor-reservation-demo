import type { ReceptionistErrorCode } from "@/types/receptionist";

export type ReceptionistErrorStatus = 400 | 401 | 403 | 404 | 409 | 500;

export class ReceptionistServiceError extends Error {
  readonly status: ReceptionistErrorStatus;
  readonly code: ReceptionistErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    status: ReceptionistErrorStatus,
    code: ReceptionistErrorCode,
    message: string,
    details?: {
      fieldErrors?: Record<string, string>;
    },
  ) {
    super(message);
    this.name = "ReceptionistServiceError";
    this.status = status;
    this.code = code;
    this.fieldErrors = details?.fieldErrors;
  }
}

export interface ReceptionistDbErrorMessages {
  notFound?: string;
  constraint?: string;
  fallback: string;
}

const DEFAULT_NOT_FOUND_MESSAGE = "الحجز المطلوب مش موجود.";
const DEFAULT_CONSTRAINT_MESSAGE = "البيانات مش مظبوطة، راجعها وحاول تاني.";

/**
 * Maps PostgREST / PostgreSQL error codes into safe, localized
 * `ReceptionistServiceError` instances without exposing raw database internals.
 */
export function mapReceptionistDbError(
  error: { code?: string; message?: string; details?: string } | null | undefined,
  messages: ReceptionistDbErrorMessages,
): ReceptionistServiceError {
  switch (error?.code) {
    case "23514":
    case "22P02":
      return new ReceptionistServiceError(
        400,
        "VALIDATION_ERROR",
        messages.constraint ?? DEFAULT_CONSTRAINT_MESSAGE,
      );
    case "PGRST116":
      return new ReceptionistServiceError(
        404,
        "NOT_FOUND",
        messages.notFound ?? DEFAULT_NOT_FOUND_MESSAGE,
      );
    default:
      return new ReceptionistServiceError(
        500,
        "INTERNAL_ERROR",
        messages.fallback,
      );
  }
}
