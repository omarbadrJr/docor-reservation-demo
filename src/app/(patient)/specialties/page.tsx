import { SpecialtyCard } from "@/components/doctors/specialty-card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";
import { createClient } from "@/lib/supabase/server";
import { listActiveSpecialties } from "@/services/specialties";

export default async function SpecialtiesPage() {
  const client = await createClient();
  const specialties = await listActiveSpecialties(client);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        title="اختار التخصص"
        description="اختار التخصص اللي يناسبك، وهتلاقي الدكاترة المتاحين فيه."
      />

      {specialties.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="لسه مفيش تخصصات متاحة"
          description="العيادات لسه بتجهّز التخصصات. جرّب تاني بعد شوية."
        />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {specialties.map((specialty) => (
            <SpecialtyCard key={specialty.id} specialty={specialty} />
          ))}
        </div>
      )}
    </div>
  );
}
