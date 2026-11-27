import { createReceptionistAppointmentByReferenceGetHandler } from "@/services/receptionist-appointments";

const handleGet = createReceptionistAppointmentByReferenceGetHandler();

export async function GET(
  request: Request,
  context: { params: Promise<{ reference: string }> },
): Promise<Response> {
  return handleGet(request, context);
}
