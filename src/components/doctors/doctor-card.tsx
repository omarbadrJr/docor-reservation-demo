import Link from "next/link";
import * as React from "react";

import { DoctorPhoto } from "@/components/doctors/doctor-photo";
import type { DoctorCardData } from "@/types/catalog";
import { formatConsultationFee } from "@/lib/format";
import { cn } from "@/lib/utils";

function DoctorCard({
  doctor,
  className,
}: {
  doctor: DoctorCardData;
  className?: string;
}) {
  return (
    <Link
      href={`/doctors/${encodeURIComponent(doctor.id)}`}
      className={cn("block rounded-md focus-visible:ring-3 focus-visible:ring-ring", className)}
    >
      <article className="rounded-md border border-border bg-card p-5 transition-colors hover:border-primary/40 sm:p-6">
        <div className="flex items-start gap-4">
          <DoctorPhoto photoUrl={null} name={doctor.fullName} className="size-20" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-primary">{doctor.specialtyName}</p>
            <h2 className="mt-1 font-heading text-xl font-extrabold">
              {doctor.fullName}
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {doctor.bio ?? "مفيش وصف مضاف للدكتور. تقدر تشوف المواعيد والعنوان."}
            </p>
          </div>
        </div>

        <div className="my-5 border-t border-dashed border-border" aria-hidden="true" />

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
      </article>
    </Link>
  );
}

export { DoctorCard };
