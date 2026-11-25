import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";
import { createClient } from "@/lib/supabase/server";
import { parseCatalogId } from "@/lib/validations/catalog";
import { getPublicDoctorById } from "@/services/doctors";

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const doctorId = parseCatalogId(params.doctorId);

  let doctorName: string | null = null;
  if (doctorId) {
    const client = await createClient();
    doctorName = (await getPublicDoctorById(client, doctorId))?.fullName ?? null;
  }

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
        title="المواعيد المتاحة"
        description={doctorName ? `اختار معادك عند ${doctorName}.` : undefined}
      />
      <EmptyState
        className="mt-8"
        title="المواعيد جاهزة قريب"
        description="بنجهّز عرض المواعيد المتاحة. دلوقتي تقدر ترجع تختار تخصص أو دكتور تاني."
        action={
          <Link
            href="/specialties"
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 py-2 font-bold text-primary-foreground"
          >
            اختار التخصص
          </Link>
        }
      />
    </div>
  );
}
