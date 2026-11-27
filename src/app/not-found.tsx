import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-12 sm:px-6">
      <EmptyState
        title="الصفحة دي مش موجودة"
        description="الرابط اللي فتحته مش صحيح أو الصفحة اتنقلت. تقدر ترجع للرئيسية أو تحجز عند دكتور."
        action={
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "w-full sm:w-auto",
              )}
            >
              الرجوع للرئيسية
            </Link>
            <Link
              href="/specialties"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full sm:w-auto",
              )}
            >
              احجز عند دكتور
            </Link>
          </div>
        }
      />
    </div>
  );
}
