import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";

export default function OwnerClinicsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="العيادات"
        description="هنا هتضيف العيادات وتعدّل بياناتها."
      />
      <EmptyState
        className="mt-8"
        title="إدارة العيادات جاية في المراحل الجاية"
        description="بنجهّز لك شاشة إضافة وتعديل العيادات وعناوينها."
      />
    </div>
  );
}
