import { createLoginPostHandler } from "../_shared";

const handlePost = createLoginPostHandler();

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}
