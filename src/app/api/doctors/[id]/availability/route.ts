import { createAdminClient } from "@/lib/supabase/admin";
import { parseAvailabilityDate } from "@/lib/validations/availability";
import { parseCatalogId } from "@/lib/validations/catalog";
import { getDoctorAvailability } from "@/services/availability";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!parseCatalogId(id)) {
    return Response.json(
      { error: "رقم الدكتور غير صحيح." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const date = parseAvailabilityDate(
    new URL(request.url).searchParams.get("date"),
  );
  if (!date) {
    return Response.json(
      { error: "التاريخ غير صحيح." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const client = createAdminClient();
    const availability = await getDoctorAvailability(client, id, date);
    if (!availability) {
      return Response.json(
        { error: "الدكتور ده غير متاح دلوقتي." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    return Response.json({ availability }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("Failed to load doctor availability", error);
    return Response.json(
      { error: "مش قادرين نجيب المواعيد دلوقتي، حاول تاني بعد شوية." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
