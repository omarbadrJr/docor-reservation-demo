import { z } from "zod";

const postgresUuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
);

export function parseCatalogId(
  value: string | string[] | undefined,
): string | null {
  const result = postgresUuidSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseSpecialtyId(
  value: string | string[] | undefined,
): string | null {
  return parseCatalogId(value);
}
