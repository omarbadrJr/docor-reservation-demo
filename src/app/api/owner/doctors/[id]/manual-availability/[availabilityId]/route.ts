import { createManualAvailabilityDeleteHandler } from "@/services/owner-schedules";

const handleDelete = createManualAvailabilityDeleteHandler();

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; availabilityId: string }> },
): Promise<Response> {
  return handleDelete(request, context);
}
