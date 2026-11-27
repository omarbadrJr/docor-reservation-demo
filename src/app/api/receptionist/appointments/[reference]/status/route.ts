import { createReceptionistAppointmentStatusPatchHandler } from "@/services/receptionist-appointments";

const handlePatch = createReceptionistAppointmentStatusPatchHandler();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ reference: string }> },
): Promise<Response> {
  return handlePatch(request, context);
}
