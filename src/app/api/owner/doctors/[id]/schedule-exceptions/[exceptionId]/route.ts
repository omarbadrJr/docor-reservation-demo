import { createScheduleExceptionDeleteHandler } from "@/services/owner-schedules";

const handleDelete = createScheduleExceptionDeleteHandler();

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; exceptionId: string }> },
): Promise<Response> {
  return handleDelete(request, context);
}
