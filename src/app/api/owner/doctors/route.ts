import {
  createOwnerDoctorsGetHandler,
  createOwnerDoctorsPostHandler,
} from "@/services/owner-doctors";

const handleGet = createOwnerDoctorsGetHandler();
const handlePost = createOwnerDoctorsPostHandler();

export async function GET(request: Request): Promise<Response> {
  return handleGet(request);
}

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}
