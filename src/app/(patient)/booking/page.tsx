import Link from "next/link";

import { BookingFlow } from "@/components/booking/booking-flow";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";
import { getCairoNow } from "@/lib/cairo-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAnonClient } from "@/lib/supabase/anon";
import { parseCatalogId } from "@/lib/validations/catalog";
import {
  getDoctorAvailability,
  listDoctorAvailableDates,
} from "@/services/availability";
import { getPublicDoctorById } from "@/services/doctors";
import type { BookingDoctorSummary } from "@/types/booking";

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const doctorId = parseCatalogId(params.doctorId);

  if (!doctorId) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/specialties"
          className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline"
        >
          ← الرجوع للتخصصات
        </Link>
        <PageHeader className="mt-6" title="المواعيد المتاحة" />
        <EmptyState
          className="mt-8"
          title="اختار دكتور الأول"
          description="اختار التخصص وبعدين اختار الدكتور عشان تشوف مواعيده المتاحة."
          action={
            <Link
              href="/specialties"
              className={buttonVariants({ variant: "default", size: "default" })}
            >
              اختار التخصص
            </Link>
          }
        />
      </div>
    );
  }

  const doctor = await getPublicDoctorById(createAnonClient(), doctorId);
  if (!doctor) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/specialties"
          className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline"
        >
          ← الرجوع للتخصصات
        </Link>
        <PageHeader className="mt-6" title="المواعيد المتاحة" />
        <EmptyState
          className="mt-8"
          title="الدكتور ده غير متاح للحجز دلوقتي."
          description="تقدر تختار دكتور تاني من التخصصات المتاحة."
          action={
            <Link
              href="/specialties"
              className={buttonVariants({ variant: "default", size: "default" })}
            >
              اختار التخصص
            </Link>
          }
        />
      </div>
    );
  }

  const now = getCairoNow();
  const todayDate = now.date;
  const initialMonth = todayDate.slice(0, 7);

  const adminClient = createAdminClient();
  const initialDates =
    (await listDoctorAvailableDates(adminClient, doctor.id, initialMonth, now)) ??
    [];
  const initialSelectedDate =
    initialDates.find(
      (entry) => entry.date >= todayDate && entry.state === "AVAILABLE",
    )?.date ?? null;
  const initialAvailability = initialSelectedDate
    ? await getDoctorAvailability(
        adminClient,
        doctor.id,
        initialSelectedDate,
        now,
      )
    : null;

  const doctorSummary: BookingDoctorSummary = {
    id: doctor.id,
    fullName: doctor.fullName,
    specialtyName: doctor.specialtyName,
    clinicName: doctor.clinicName,
    clinicAddress: doctor.clinicAddress,
    consultationFee: doctor.consultationFee,
    photoUrl: doctor.photoUrl,
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href={`/doctors/${encodeURIComponent(doctor.id)}`}
        className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline"
      >
        ← الرجوع لصفحة الدكتور
      </Link>
      <PageHeader
        className="mt-6"
        title="المواعيد المتاحة"
        description={`اختار اليوم والمعاد المناسب عند ${doctor.fullName}.`}
      />
      <BookingFlow
        doctor={doctorSummary}
        todayDate={todayDate}
        initialMonth={initialMonth}
        initialDates={initialDates}
        initialSelectedDate={initialSelectedDate}
        initialAvailability={initialAvailability}
      />
    </div>
  );
}
