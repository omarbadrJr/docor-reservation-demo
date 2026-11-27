import { createOwnerAppointmentsGetHandler } from "@/services/owner-appointments";

const handleGet = createOwnerAppointmentsGetHandler();

export async function GET(request: Request): Promise<Response> {
  return handleGet(request);
}
