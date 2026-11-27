import { createDoctorSchedulesGetHandler } from "@/services/owner-schedules";

const handleGet = createDoctorSchedulesGetHandler();

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleGet(request, context);
}
