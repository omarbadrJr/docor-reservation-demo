import { createReceptionistAppointmentLookupGetHandler } from "@/services/receptionist-appointments";

const handleGet = createReceptionistAppointmentLookupGetHandler();

export async function GET(request: Request): Promise<Response> {
  return handleGet(request);
}
