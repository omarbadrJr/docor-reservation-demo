import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";

export default function ReceptionistHomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="مواعيد العيادة"
        description="هنا هتلاقي حجوزات النهارده، وتقدر تسجّل وصول المرضى."
      />
      <EmptyState
        className="mt-8"
        title="شاشة المواعيد جاية قريب"
        description="بنجهّز لك قائمة الحجوزات والبحث برقم الحجز أو مسح الكود."
      />
    </div>
  );
}
