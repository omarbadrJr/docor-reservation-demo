import { createAnonClient } from "@/lib/supabase/anon";
import { listActiveSpecialties } from "@/services/specialties";

export async function GET() {
  try {
    const client = createAnonClient();
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
