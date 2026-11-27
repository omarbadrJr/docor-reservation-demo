import { createScheduleExceptionPostHandler } from "@/services/owner-schedules";

const handlePost = createScheduleExceptionPostHandler();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handlePost(request, context);
}
