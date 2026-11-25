import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";

export default function OwnerReceptionistsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="موظفي الاستقبال"
        description="هنا هتضيف حسابات موظفي الاستقبال وتحدد عيادة كل واحد."
      />
      <EmptyState
        className="mt-8"
        title="إدارة الحسابات جاية في المراحل الجاية"
        description="بنجهّز لك شاشة إنشاء الحسابات وربطها بالعيادات."
      />
    </div>
  );
}
