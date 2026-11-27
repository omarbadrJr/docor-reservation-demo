import { createOwnerClinicPatchHandler } from "@/services/owner-clinics";

const handlePatch = createOwnerClinicPatchHandler();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handlePatch(request, context);
}
