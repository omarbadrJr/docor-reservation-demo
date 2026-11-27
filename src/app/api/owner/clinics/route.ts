import {
  createOwnerClinicsGetHandler,
  createOwnerClinicsPostHandler,
} from "@/services/owner-clinics";

const handleGet = createOwnerClinicsGetHandler();
const handlePost = createOwnerClinicsPostHandler();

export async function GET(): Promise<Response> {
  return handleGet();
}

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}
