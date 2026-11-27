import { createWeeklySchedulePostHandler } from "@/services/owner-schedules";

const handlePost = createWeeklySchedulePostHandler();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handlePost(request, context);
}
