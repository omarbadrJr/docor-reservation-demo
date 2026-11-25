import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";

export default function OwnerHomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="أهلاً بيك"
        description="من هنا هتقدر تدير العيادات والدكاترة والمواعيد."
      />
      <EmptyState
        className="mt-8"
        title="لوحة التحكم جاية في المراحل الجاية"
        description="بنجهّز لك شاشات إدارة العيادات والدكاترة والمواعيد خطوة بخطوة."
      />
    </div>
  );
}
