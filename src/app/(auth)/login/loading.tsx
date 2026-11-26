import { LoadingState } from "@/components/ui/state";

export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-background px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-md">
        <LoadingState
          title="بنجهّز صفحة الدخول..."
          description="استنى لحظة وهتلاقي نموذج تسجيل الدخول جاهز."
        />
      </div>
    </main>
  );
}
