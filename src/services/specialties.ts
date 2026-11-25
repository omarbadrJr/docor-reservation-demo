import type { SupabaseClient } from "@supabase/supabase-js";

import type { SpecialtySummary } from "@/types/catalog";
import type { Database } from "@/types/database";

export type CatalogClient = SupabaseClient<Database>;

async function defaultClient(): Promise<CatalogClient> {
  const { createClient } = await import("@/lib/supabase/server");
  return createClient();
}

export async function listActiveSpecialties(
  client?: CatalogClient,
): Promise<SpecialtySummary[]> {
  const db = client ?? (await defaultClient());
  const { data, error } = await db
    .from("specialties")
    .select("id, name, description")
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error("مش قادرين نجيب التخصصات دلوقتي، حاول تاني بعد شوية.");
  }

  return data ?? [];
}

export async function getActiveSpecialty(
  client: CatalogClient,
  id: string,
): Promise<SpecialtySummary | null> {
  const { data, error } = await client
    .from("specialties")
    .select("id, name, description")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error("مش قادرين نجيب التخصص دلوقتي، حاول تاني بعد شوية.");
  }

  return data ?? null;
}
