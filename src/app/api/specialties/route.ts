import { createClient } from "@/lib/supabase/server";
import { listActiveSpecialties } from "@/services/specialties";

export async function GET() {
  try {
    const client = await createClient();
    const specialties = await listActiveSpecialties(client);
    return Response.json({ specialties });
  } catch (error) {
    console.error("Failed to list specialties", error);
    return Response.json(
      { error: "مش قادرين نجيب التخصصات دلوقتي، حاول تاني بعد شوية." },
      { status: 500 },
    );
  }
}
