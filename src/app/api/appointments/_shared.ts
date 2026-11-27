import {
  parseCancelAppointmentInput,
  parseLookupQuery,
  parseRescheduleAppointmentInput,
} from "@/lib/validations/appointments";
import {
  BookingServiceError,
  cancelAppointment,
  lookupAppointments,
  rescheduleAppointment,
} from "@/services/appointments";
import type { CatalogClient } from "@/services/specialties";
import type {
  BookingManagementErrorResponse,
  LookupAppointmentsResponse,
  UpdateAppointmentResponse,
} from "@/types/booking";

const INVALID_JSON_ERROR = "البيانات مش مظبوطة، راجعها وحاول تاني.";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function toErrorResponse(
  error: unknown,
  logContext: string,
  fallbackMessage: string,
): Response {
  if (error instanceof BookingServiceError) {
    return Response.json(
      {
        error: error.message,
        code: error.code,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
        ...(error.availability ? { availability: error.availability } : {}),
      } satisfies BookingManagementErrorResponse,
      { status: error.status, headers: NO_STORE_HEADERS },
    );
  }

  console.error(logContext, error);
  return Response.json(
    {
      error: fallbackMessage,
      code: "INTERNAL_ERROR",
    } satisfies BookingManagementErrorResponse,
    { status: 500, headers: NO_STORE_HEADERS },
  );
}

async function readJsonBody(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return {
      ok: false,
      response: Response.json(
        {
          error: INVALID_JSON_ERROR,
          code: "VALIDATION_ERROR",
        } satisfies BookingManagementErrorResponse,
        { status: 400, headers: NO_STORE_HEADERS },
      ),
    };
  }
}

export async function handleLookupGet(
  request: Request,
  getClient: () => CatalogClient,
): Promise<Response> {
  const parsed = parseLookupQuery(new URL(request.url).searchParams);
  if (!parsed.success) {
    return Response.json(
      {
        error: parsed.error,
        code: "VALIDATION_ERROR",
        fieldErrors: parsed.fieldErrors,
      } satisfies BookingManagementErrorResponse,
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const result = await lookupAppointments(getClient(), parsed.data);
    return Response.json(result satisfies LookupAppointmentsResponse, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return toErrorResponse(
      error,
      "Failed to look up appointments",
      "حصلت مشكلة وإحنا بندور على الحجز، حاول تاني بعد شوية.",
    );
  }
}

export async function handleReschedulePatch(
  request: Request,
  appointmentId: string,
  getClient: () => CatalogClient,
): Promise<Response> {
  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = parseRescheduleAppointmentInput(appointmentId, bodyResult.body);
  if (!parsed.success) {
    return Response.json(
      {
        error: parsed.error,
        code: "VALIDATION_ERROR",
        fieldErrors: parsed.fieldErrors,
      } satisfies BookingManagementErrorResponse,
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const result = await rescheduleAppointment(getClient(), parsed.data);
    return Response.json(result satisfies UpdateAppointmentResponse, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return toErrorResponse(
      error,
      "Failed to reschedule appointment",
      "حصلت مشكلة وإحنا بنغيّر المعاد، حاول تاني بعد شوية.",
    );
  }
}

export async function handleCancelPatch(
  request: Request,
  appointmentId: string,
  getClient: () => CatalogClient,
): Promise<Response> {
  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = parseCancelAppointmentInput(appointmentId, bodyResult.body);
  if (!parsed.success) {
    return Response.json(
      {
        error: parsed.error,
        code: "VALIDATION_ERROR",
        fieldErrors: parsed.fieldErrors,
      } satisfies BookingManagementErrorResponse,
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const result = await cancelAppointment(getClient(), parsed.data);
    return Response.json(result satisfies UpdateAppointmentResponse, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return toErrorResponse(
      error,
      "Failed to cancel appointment",
      "حصلت مشكلة وإحنا بنلغي الحجز، حاول تاني بعد شوية.",
    );
  }
}
