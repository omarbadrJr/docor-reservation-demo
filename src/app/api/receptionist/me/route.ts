import { createReceptionistMeGetHandler } from "@/app/api/admin/_shared";

const handleGet = createReceptionistMeGetHandler();

export async function GET(request: Request): Promise<Response> {
  return handleGet(request);
}
