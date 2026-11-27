import {
  createOwnerDoctorByIdGetHandler,
  createOwnerDoctorByIdPatchHandler,
} from "@/services/owner-doctors";

const handleGet = createOwnerDoctorByIdGetHandler();
const handlePatch = createOwnerDoctorByIdPatchHandler();

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return handleGet(request, id);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return handlePatch(request, id);
}
