import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";

export default function SpecialtiesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        title="اختار التخصص"
        description="هنا هتلاقي التخصصات المتاحة، وتقدر تختار اللي يناسب حالتك."
      />
      <EmptyState
        className="mt-8"
        title="التخصصات جاية في الخطوة الجاية"
        description="أول ما نفعّل بيانات العيادات، هتلاقي كل التخصصات والدكاترة هنا."
      />
    </div>
  );
}
