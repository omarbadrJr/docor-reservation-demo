import { UserRound } from "lucide-react";
import Image from "next/image";

export function DoctorPhoto({
  photoUrl,
  name,
  className = "size-20",
}: {
  photoUrl: string | null;
  name: string;
  className?: string;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-md border border-border bg-card ${className}`}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={`صورة ${name}`}
          fill
          unoptimized
          sizes="80px"
          className="object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <UserRound className="size-9" aria-hidden="true" />
          <span className="sr-only">صورة غير متاحة لـ {name}</span>
        </span>
      )}
    </div>
  );
}
