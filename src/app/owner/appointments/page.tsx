import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";

export default function OwnerAppointmentsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="الحجوزات"
        description="هنا هتشوف حجوزات كل العيادات في مكان واحد."
      />
      <EmptyState
        className="mt-8"
        title="قائمة الحجوزات جاية في المراحل الجاية"
        description="بنجهّز لك شاشة تعرض الحجوزات وتفلترها بالعيادة والدكتور."
      />
    </div>
  );
}
