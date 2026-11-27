import {
  createOwnerSpecialtiesGetHandler,
  createOwnerSpecialtiesPostHandler,
} from "@/services/owner-specialties";

const handleGet = createOwnerSpecialtiesGetHandler();
const handlePost = createOwnerSpecialtiesPostHandler();

export async function GET(): Promise<Response> {
  return handleGet();
}

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}
