import { createOwnerMeGetHandler } from "@/app/api/admin/_shared";

const handleGet = createOwnerMeGetHandler();

export async function GET(): Promise<Response> {
  return handleGet();
}
