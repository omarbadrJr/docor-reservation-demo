import { createAdminClient } from "@/lib/supabase/admin";

import { handleReschedulePatch } from "../../_shared";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handleReschedulePatch(request, id, createAdminClient);
}
