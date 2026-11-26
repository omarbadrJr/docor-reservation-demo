import { createAdminClient } from "@/lib/supabase/admin";
import { parseMonth } from "@/lib/validations/availability";
import { parseCatalogId } from "@/lib/validations/catalog";
import { listDoctorAvailableDates } from "@/services/availability";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!parseCatalogId(id)) {
    return Response.json({ error: "رقم الدكتور غير صحيح." }, { status: 400 });
  }

  const month = parseMonth(new URL(request.url).searchParams.get("month"));
  if (!month) {
    return Response.json({ error: "الشهر غير صحيح." }, { status: 400 });
  }

  try {
    const client = createAdminClient();
    const dates = await listDoctorAvailableDates(client, id, month);
    if (!dates) {
      return Response.json(
        { error: "الدكتور ده غير متاح دلوقتي." },
        { status: 404 },
      );
    }

    return Response.json({ dates });
  } catch (error) {
    console.error("Failed to load available dates", error);
    return Response.json(
      { error: "مش قادرين نجيب المواعيد دلوقتي، حاول تاني بعد شوية." },
      { status: 500 },
    );
  }
}
