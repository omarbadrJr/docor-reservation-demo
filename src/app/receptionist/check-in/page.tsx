import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";

export default function ReceptionistCheckInPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="تسجيل وصول المريض"
        description="هنا هتسجّل وصول المريض بعد ما تتأكد من حجزه."
      />
      <EmptyState
        className="mt-8"
        title="تسجيل الوصول جاي في المراحل الجاية"
        description="بنجهّز لك مسح كود الحجز وتأكيد بيانات المريض."
      />
    </div>
  );
}
