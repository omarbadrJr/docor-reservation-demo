import { createAdminClient } from "@/lib/supabase/admin";
import { parseAvailabilityDate } from "@/lib/validations/availability";
import { parseCatalogId } from "@/lib/validations/catalog";
import { getDoctorAvailability } from "@/services/availability";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!parseCatalogId(id)) {
    return Response.json({ error: "رقم الدكتور غير صحيح." }, { status: 400 });
  }

  const date = parseAvailabilityDate(
    new URL(request.url).searchParams.get("date"),
  );
  if (!date) {
    return Response.json({ error: "التاريخ غير صحيح." }, { status: 400 });
  }

  try {
    const client = createAdminClient();
    const availability = await getDoctorAvailability(client, id, date);
    if (!availability) {
      return Response.json(
        { error: "الدكتور ده غير متاح دلوقتي." },
        { status: 404 },
      );
    }

    return Response.json({ availability });
  } catch (error) {
    console.error("Failed to load doctor availability", error);
    return Response.json(
      { error: "مش قادرين نجيب المواعيد دلوقتي، حاول تاني بعد شوية." },
      { status: 500 },
    );
  }
}
