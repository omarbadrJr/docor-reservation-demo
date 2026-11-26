import {
  Baby,
  Bone,
  Droplets,
  HeartPulse,
  Stethoscope,
  Venus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Card } from "@/components/ui/card";
import type { SpecialtySummary } from "@/types/catalog";
import { cn } from "@/lib/utils";

const specialtyIcons: Record<string, LucideIcon> = {
  باطنة: Stethoscope,
  قلب: HeartPulse,
  أطفال: Baby,
  جلدية: Droplets,
  عظام: Bone,
  "نساء وتوليد": Venus,
};

function SpecialtyCard({
  specialty,
  className,
}: {
  specialty: SpecialtySummary;
  className?: string;
}) {
  const Icon = specialtyIcons[specialty.name] ?? Stethoscope;

  return (
    <Link
      href={`/doctors?specialtyId=${encodeURIComponent(specialty.id)}`}
      className={cn("block rounded-md focus-visible:ring-3 focus-visible:ring-ring", className)}
    >
      <Card className="flex h-full min-h-40 flex-col justify-between gap-6 p-5 transition-colors hover:border-primary/40 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-heading text-xl font-extrabold">{specialty.name}</h2>
          <Icon className="size-6 shrink-0 text-primary" aria-hidden="true" />
        </div>
        {specialty.description ? (
          <p className="text-sm leading-7 text-muted-foreground">
            {specialty.description}
          </p>
        ) : (
          <p className="text-sm leading-7 text-muted-foreground">
            شوف الدكاترة المتاحين في التخصص ده.
          </p>
        )}
      </Card>
    </Link>
  );
}

export { SpecialtyCard };
