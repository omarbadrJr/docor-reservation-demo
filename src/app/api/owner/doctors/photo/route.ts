import { createOwnerDoctorPhotoPostHandler } from "@/services/owner-doctors";

const handlePost = createOwnerDoctorPhotoPostHandler();

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}
