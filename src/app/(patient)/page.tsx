import Link from "next/link";
import { CalendarPlus, QrCode, Search, Stamp } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const steps = [
  {
    order: "أولاً",
    title: "اختار التخصص",
    description: "شوف التخصصات المتاحة واختار اللي محتاجه.",
  },
  {
    order: "ثانياً",
    title: "اختار الدكتور والمعاد",
    description: "شوف بيانات الدكتور والمواعيد المتاحة قدامك.",
  },
  {
    order: "ثالثاً",
    title: "أكّد الحجز",
    description: "اكتب اسمك ورقمك، وهتاخد رقم حجز وكود QR.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <section className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
        <div className="max-w-2xl">
          <p className="mb-5 inline-flex border-y border-foreground/20 py-1 text-sm font-bold text-muted-foreground">
            عيادة قريبة منك في البحيرة
          </p>
          <h1 className="text-balance text-4xl leading-[1.2] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            عايز تكشف عند دكتور إيه؟
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
            اختار التخصص والدكتور، وشوف المواعيد المتاحة، واحجز في دقيقة من غير
            حساب ولا خطوات كتير.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/specialties"
              className={cn(
                buttonVariants({ size: "xl" }),
                "w-full sm:w-auto",
              )}
            >
              <CalendarPlus className="size-5" aria-hidden="true" />
              احجز عند دكتور
            </Link>
            <Link
              href="/my-booking"
              className={cn(
                buttonVariants({ variant: "outline", size: "xl" }),
                "w-full sm:w-auto",
              )}
            >
              <Search className="size-5" aria-hidden="true" />
              عندي حجز بالفعل
            </Link>
          </div>

          <ul className="mt-7 space-y-2 border-t border-border pt-5 text-sm font-semibold text-muted-foreground">
            <li>من غير حساب.</li>
            <li>الحجز بياخد دقيقة.</li>
            <li>هتاخد رقم حجز وكود QR.</li>
          </ul>
        </div>

        <div className="relative">
          <div className="rounded-md border-2 border-foreground/25 bg-card p-2">
            <div className="border border-dashed border-foreground/30 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4 border-b border-dashed border-foreground/25 pb-5">
                <div>
                  <p className="text-sm font-bold text-muted-foreground">
                    ورقة الحجز
                  </p>
                  <p className="mt-1 text-2xl font-extrabold">تلات خطوات بس</p>
                </div>
                <Stamp
                  className="size-8 -rotate-6 text-primary"
                  aria-hidden="true"
                />
              </div>

              <ol className="divide-y divide-border">
                {steps.map((step) => (
                  <li key={step.title} className="flex gap-4 py-4">
                    <span className="w-16 shrink-0 pt-0.5 text-sm font-bold text-muted-foreground">
                      {step.order}
                    </span>
                    <div>
                      <p className="font-extrabold">{step.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-5 border-t border-dashed border-foreground/30 pt-5">
                <div className="flex items-center gap-3">
                  <QrCode className="size-6 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="font-extrabold">احتفظ برقم الحجز والكود</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      هتستخدمهم لما تروح العيادة.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-md bg-foreground px-6 py-8 text-background sm:px-10 sm:py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-bold text-background/60">تعديل الحجز</p>
            <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
              عندك حجز وعايز تغيّره؟
            </h2>
            <p className="mt-2 leading-7 text-background/75">
              تقدر تدور برقم الحجز أو رقم الموبايل، وتغيّر معادك أو تلغي الحجز.
            </p>
          </div>
          <Link
            href="/my-booking"
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "shrink-0",
            )}
          >
            عندي حجز بالفعل
          </Link>
        </div>
      </section>
    </div>
  );
}
