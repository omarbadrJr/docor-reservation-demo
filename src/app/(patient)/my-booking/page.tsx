import { MyBookingManager } from "@/components/booking/my-booking-manager";
import { PageHeader } from "@/components/layout/page-header";

export default function MyBookingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        title="عندي حجز بالفعل"
        description="دوّر على حجزك برقم الحجز أو رقم الموبايل عشان تشوف تفاصيله، تغيّر معاده، أو تلغيه."
      />
      <MyBookingManager />
    </div>
  );
}
