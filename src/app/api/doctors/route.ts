import { createAnonClient } from "@/lib/supabase/anon";
import { parseCatalogId } from "@/lib/validations/catalog";
import { listDoctorsBySpecialty } from "@/services/doctors";
import { getActiveSpecialty } from "@/services/specialties";

export async function GET(request: Request) {
  const values = new URL(request.url).searchParams.getAll("specialtyId");
  const specialtyId = values.length === 1 ? parseCatalogId(values[0]) : null;

  if (!specialtyId) {
    return Response.json(
      { error: "اختار تخصص صح من القائمة، وبعدين شوف الدكاترة." },
      { status: 400 },
    );
  }

  try {
    const client = createAnonClient();
    const specialty = await getActiveSpecialty(client, specialtyId);
    if (!specialty) {
      return Response.json(
        { error: "التخصص ده غير متاح دلوقتي." },
        { status: 404 },
      );
    }

    const doctors = await listDoctorsBySpecialty(client, specialty);
    return Response.json({ doctors });
  } catch (error) {
    console.error("Failed to list doctors", error);
    return Response.json(
      { error: "مش قادرين نجيب الدكاترة دلوقتي، حاول تاني بعد شوية." },
      { status: 500 },
    );
  }
}
