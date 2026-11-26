import { createAdminClient } from "@/lib/supabase/admin";

import { handleCancelPatch } from "../../_shared";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handleCancelPatch(request, id, createAdminClient);
}
