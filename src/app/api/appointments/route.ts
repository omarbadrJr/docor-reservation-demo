import { createAdminClient } from "@/lib/supabase/admin";
import { parseCreateAppointmentInput } from "@/lib/validations/appointments";
import { BookingServiceError, createAppointment } from "@/services/appointments";
import type {
  CreateAppointmentErrorResponse,
  CreateAppointmentResponse,
} from "@/types/booking";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: "بيانات الحجز مش مظبوطة، راجعها وحاول تاني.",
        code: "VALIDATION_ERROR",
      } satisfies CreateAppointmentErrorResponse,
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const parsed = parseCreateAppointmentInput(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: parsed.error,
        code: "VALIDATION_ERROR",
        fieldErrors: parsed.fieldErrors,
      } satisfies CreateAppointmentErrorResponse,
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const booking = await createAppointment(createAdminClient(), parsed.data);
    return Response.json(
      { booking } satisfies CreateAppointmentResponse,
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof BookingServiceError) {
      return Response.json(
        {
          error: error.message,
          code: error.code,
          ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
          ...(error.availability ? { availability: error.availability } : {}),
        } satisfies CreateAppointmentErrorResponse,
        { status: error.status, headers: NO_STORE_HEADERS },
      );
    }

    console.error("Failed to create appointment", error);
    return Response.json(
      {
        error: "حصلت مشكلة وإحنا بنسجل الحجز، حاول تاني بعد شوية.",
        code: "INTERNAL_ERROR",
      } satisfies CreateAppointmentErrorResponse,
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
