import {
  createWeeklyScheduleDeleteHandler,
  createWeeklySchedulePatchHandler,
} from "@/services/owner-schedules";

const handlePatch = createWeeklySchedulePatchHandler();
const handleDelete = createWeeklyScheduleDeleteHandler();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; scheduleId: string }> },
): Promise<Response> {
  return handlePatch(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; scheduleId: string }> },
): Promise<Response> {
  return handleDelete(request, context);
}
