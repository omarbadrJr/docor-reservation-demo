import {
  createOwnerReceptionistsGetHandler,
  createOwnerReceptionistsPostHandler,
} from "@/services/owner-receptionists";

const handleGet = createOwnerReceptionistsGetHandler();
const handlePost = createOwnerReceptionistsPostHandler();

export async function GET(): Promise<Response> {
  return handleGet();
}

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}
