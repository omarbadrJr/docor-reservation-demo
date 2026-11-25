import { createAnonClient } from "@/lib/supabase/anon";
import { parseCatalogId } from "@/lib/validations/catalog";
import { getPublicDoctorById } from "@/services/doctors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!parseCatalogId(id)) {
    return Response.json(
      { error: "رقم الدكتور غير صحيح." },
      { status: 400 },
    );
  }

  try {
    const client = createAnonClient();
    const doctor = await getPublicDoctorById(client, id);
    if (!doctor) {
      return Response.json(
        { error: "الدكتور ده غير متاح دلوقتي." },
        { status: 404 },
      );
    }

    return Response.json({ doctor });
  } catch (error) {
    console.error("Failed to load doctor", error);
    return Response.json(
      { error: "مش قادرين نجيب بيانات الدكتور دلوقتي، حاول تاني بعد شوية." },
      { status: 500 },
    );
  }
}
