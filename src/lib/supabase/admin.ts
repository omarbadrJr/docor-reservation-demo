import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "./env";

export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient must only be called on the server.");
  }

  const { url } = getSupabasePublicEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
