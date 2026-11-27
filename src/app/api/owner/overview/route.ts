import { createOwnerOverviewGetHandler } from "@/services/owner-appointments";

const handleGet = createOwnerOverviewGetHandler();

export async function GET(): Promise<Response> {
  return handleGet();
}
