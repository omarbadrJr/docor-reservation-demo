import { createReceptionistAppointmentCheckInPostHandler } from "@/services/receptionist-appointments";

const handlePost = createReceptionistAppointmentCheckInPostHandler();

export async function POST(
  request: Request,
  context: { params: Promise<{ reference: string }> },
): Promise<Response> {
  return handlePost(request, context);
}
