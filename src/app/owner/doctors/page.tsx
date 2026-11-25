import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";

export default function OwnerDoctorsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="الدكاترة"
        description="هنا هتضيف الدكاترة وتربط كل دكتور بعيادة وتخصص."
      />
      <EmptyState
        className="mt-8"
        title="إدارة الدكاترة جاية في المراحل الجاية"
        description="بنجهّز لك شاشة إضافة الدكتور وبياناته ومواعيده."
      />
    </div>
  );
}
