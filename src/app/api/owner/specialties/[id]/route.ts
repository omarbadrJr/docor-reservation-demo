import { createOwnerSpecialtyPatchHandler } from "@/services/owner-specialties";

const handlePatch = createOwnerSpecialtyPatchHandler();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handlePatch(request, context);
}
