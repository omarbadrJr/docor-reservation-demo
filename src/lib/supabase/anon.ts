import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { getSupabasePublicEnv } from "./env";

/** Read-only anon client for public catalog data; no cookies or session needed. */
export function createAnonClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createSupabaseClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
