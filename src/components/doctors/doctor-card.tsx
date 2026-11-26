import Link from "next/link";
import * as React from "react";

import { DoctorPhoto } from "@/components/doctors/doctor-photo";
import { buttonVariants } from "@/components/ui/button";
import { formatConsultationFee } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DoctorCardData } from "@/types/catalog";

function DoctorCard({
  doctor,
  className,
}: {
  doctor: DoctorCardData;
  className?: string;
}) {
  const doctorHref = `/doctors/${encodeURIComponent(doctor.id)}`;
  const bookingHref = `/booking?doctorId=${encodeURIComponent(doctor.id)}`;

  return (
    <article
      className={cn(
        "flex h-full flex-col justify-between rounded-md border border-border bg-card p-5 transition-colors hover:border-primary/40 sm:p-6",
        className,
      )}
    >
      <div>
        <div className="flex items-start gap-4">
          <DoctorPhoto
            photoUrl={doctor.photoUrl}
            name={doctor.fullName}
            className="size-20"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-primary">
              {doctor.specialtyName}
            </p>
            <h2 className="mt-1 font-heading text-xl font-extrabold">
              <Link
                href={doctorHref}
                className="rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
              >
                {doctor.fullName}
              </Link>
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {doctor.bio ??
                "مفيش وصف مضاف للدكتور. تقدر تشوف المواعيد والعنوان."}
            </p>
          </div>
        </div>

        <div
          className="my-5 border-t border-dashed border-border"
          aria-hidden="true"
        />

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-bold text-foreground">العيادة</dt>
            <dd className="mt-1 leading-7 text-muted-foreground">
              {doctor.clinicName}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-foreground">العنوان</dt>
            <dd className="mt-1 leading-7 text-muted-foreground">
              {doctor.clinicAddress}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-foreground">الكشف</dt>
            <dd className="mt-1 leading-7 text-foreground">
              {formatConsultationFee(doctor.consultationFee)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 flex flex-col gap-2.5 border-t border-border pt-4 sm:flex-row">
        <Link
          href={bookingHref}
          className={cn(
            buttonVariants({ variant: "default", size: "default" }),
            "w-full sm:flex-1",
          )}
        >
          احجز عند الدكتور
        </Link>
        <Link
          href={doctorHref}
          className={cn(
            buttonVariants({ variant: "outline", size: "default" }),
            "w-full sm:flex-1",
          )}
        >
          تفاصيل الدكتور
        </Link>
      </div>
    </article>
  );
}

export { DoctorCard };
