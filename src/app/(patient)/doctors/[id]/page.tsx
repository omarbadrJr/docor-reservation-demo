import Link from "next/link";
import { notFound } from "next/navigation";

import { DoctorProfile } from "@/components/doctors/doctor-profile";
import { createClient } from "@/lib/supabase/server";
import { parseCatalogId } from "@/lib/validations/catalog";
import { getPublicDoctorById } from "@/services/doctors";

export default async function DoctorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!parseCatalogId(id)) {
    notFound();
  }

  const client = await createClient();
  const doctor = await getPublicDoctorById(client, id);
  if (!doctor) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/specialties"
        className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline"
      >
        ← الرجوع للتخصصات
      </Link>
      <DoctorProfile className="mt-6" doctor={doctor} />
    </div>
  );
}
