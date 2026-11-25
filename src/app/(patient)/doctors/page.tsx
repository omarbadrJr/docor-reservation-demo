import Link from "next/link";
import { redirect } from "next/navigation";

import { DoctorCard } from "@/components/doctors/doctor-card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";
import { createClient } from "@/lib/supabase/server";
import { parseSpecialtyId } from "@/lib/validations/catalog";
import { listDoctorsBySpecialty } from "@/services/doctors";
import { getActiveSpecialty } from "@/services/specialties";

export default async function DoctorsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const specialtyId = parseSpecialtyId(params.specialtyId);
  if (!specialtyId) {
    redirect("/specialties");
  }

  const client = await createClient();
  const specialty = await getActiveSpecialty(client, specialtyId);
  if (!specialty) {
    redirect("/specialties");
  }

  const doctors = await listDoctorsBySpecialty(client, specialty);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/specialties"
        className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline"
      >
        ← الرجوع للتخصصات
      </Link>

      <PageHeader
        className="mt-6"
        title={`دكاترة ${specialty.name}`}
        description={specialty.description ?? "اختار الدكتور اللي يناسبك وشوف المواعيد المتاحة."}
      />

      {doctors.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="لسه مفيش دكاترة متاحين هنا"
          description="جرّب تخصص تاني، أو ارجع بعد شوية."
        />
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {doctors.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} />
          ))}
        </div>
      )}
    </div>
  );
}
