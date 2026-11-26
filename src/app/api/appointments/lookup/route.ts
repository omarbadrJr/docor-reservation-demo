import { createAdminClient } from "@/lib/supabase/admin";

import { handleLookupGet } from "../_shared";

export async function GET(request: Request) {
  return handleLookupGet(request, createAdminClient);
}
