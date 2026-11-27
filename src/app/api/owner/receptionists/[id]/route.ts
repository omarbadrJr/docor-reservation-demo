import { createOwnerReceptionistPatchHandler } from "@/services/owner-receptionists";

const handlePatch = createOwnerReceptionistPatchHandler();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return handlePatch(request, id);
}
