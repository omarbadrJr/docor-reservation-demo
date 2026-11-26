import type { ClinicSummary } from "@/types/catalog";

import type { CatalogClient } from "./specialties";

export async function getActiveClinic(
  client: CatalogClient,
  id: string,
): Promise<ClinicSummary | null> {
  const { data, error } = await client
    .from("clinics")
    .select("id, name, address")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error("مش قادرين نجيب بيانات العيادة دلوقتي، حاول تاني بعد شوية.");
  }

  return data ?? null;
}
