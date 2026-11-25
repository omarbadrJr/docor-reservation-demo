import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";

export default function ReceptionistAppointmentsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="كل الحجوزات"
        description="هنا هتلاقي حجوزات العيادة وتقدر تدوّر برقم الحجز."
      />
      <EmptyState
        className="mt-8"
        title="قائمة الحجوزات جاية في المراحل الجاية"
        description="بنجهّز لك البحث برقم الحجز أو رقم الموبايل."
      />
    </div>
  );
}
