import { createLogoutPostHandler } from "../_shared";

const handlePost = createLogoutPostHandler();

export async function POST(): Promise<Response> {
  return handlePost();
}
