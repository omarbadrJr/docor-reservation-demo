import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";

export default function MyBookingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        title="عندي حجز بالفعل"
        description="هنا هتقدر تدور على حجزك برقم الحجز أو رقم الموبايل."
      />
      <EmptyState
        className="mt-8"
        title="تدوير الحجز هيبقى متاح قريب"
        description="بنجهّز لك طريقة سهلة تشوف بيها حجزك، وتغيّر معادك أو تلغيه."
      />
    </div>
  );
}
