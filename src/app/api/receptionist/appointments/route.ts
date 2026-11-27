import { createReceptionistAppointmentsGetHandler } from "@/services/receptionist-appointments";

const handleGet = createReceptionistAppointmentsGetHandler();

export async function GET(request: Request): Promise<Response> {
  return handleGet(request);
}
