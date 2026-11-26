import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/ui/state";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        title="اختار التخصص"
        description="بنجهّز التخصصات المتاحة لك."
      />
      <LoadingState className="mt-8" />
    </div>
  );
}
