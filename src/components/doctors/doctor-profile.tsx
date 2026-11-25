import Link from "next/link";
import * as React from "react";

import { DoctorPhoto } from "@/components/doctors/doctor-photo";
import { buttonVariants } from "@/components/ui/button";
import { formatConsultationFee, formatExperienceYears } from "@/lib/format";
import { formatWorkingSchedule } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { DoctorProfileData } from "@/types/catalog";

function DoctorProfile({
  doctor,
  className,
}: {
  doctor: DoctorProfileData;
  className?: string;
}) {
  const experience = formatExperienceYears(doctor.experienceYears);
  const schedule = formatWorkingSchedule(doctor.workingSchedule);

  return (
    <div className={cn("mx-auto w-full max-w-3xl", className)}>
      <article className="rounded-md border border-border bg-card p-5 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <DoctorPhoto
            photoUrl={doctor.photoUrl}
            name={doctor.fullName}
            className="size-28"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-primary">{doctor.specialtyName}</p>
            <h1 className="mt-1 font-heading text-3xl font-extrabold">
              {doctor.fullName}
            </h1>
            {doctor.bio ? (
              <p className="mt-3 text-base leading-7 text-muted-foreground">
                {doctor.bio}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {doctor.qualifications ? (
                <p className="font-bold">{doctor.qualifications}</p>
              ) : null}
              {experience ? (
                <p className="text-muted-foreground">{experience}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="my-6 border-t border-dashed border-border" aria-hidden="true" />

        <div className="grid gap-6 sm:grid-cols-2">
          <section aria-labelledby="clinic-heading">
            <h2 id="clinic-heading" className="font-heading text-lg font-extrabold">
              العيادة
            </h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="font-bold">اسم العيادة</dt>
                <dd className="mt-1 leading-7 text-muted-foreground">
                  {doctor.clinicName}
                </dd>
              </div>
              <div>
                <dt>عنوان العيادة</dt>
                <dd className="mt-1 leading-7 text-muted-foreground">
                  {doctor.clinicAddress}
                </dd>
              </div>
              <div>
                <dt className="font-bold">الكشف</dt>
                <dd className="mt-1 leading-7 text-foreground">
                  {formatConsultationFee(doctor.consultationFee)}
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="schedule-heading">
            <h2 id="schedule-heading" className="font-heading text-lg font-extrabold">
              أيام العمل
            </h2>
            {schedule.length === 0 ? (
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                لسه مفيش أيام عمل مضافة.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm leading-7 text-muted-foreground">
                {schedule.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <Link
            href={`/booking?doctorId=${encodeURIComponent(doctor.id)}`}
            className={buttonVariants({ variant: "default", size: "default" })}
          >
            المواعيد المتاحة
          </Link>
        </div>
      </article>
    </div>
  );
}

export { DoctorProfile };
