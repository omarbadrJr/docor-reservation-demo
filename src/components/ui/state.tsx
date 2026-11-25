import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

type StateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
};

function StateFrame({
  title,
  description,
  action,
  icon,
  className,
  role,
  live,
}: StateProps & { role?: "status" | "alert"; live?: "polite" | "assertive" }) {
  return (
    <div
      role={role}
      aria-live={live}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-primary">
          {icon}
        </div>
      ) : null}
      <h2 className="text-xl font-extrabold">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function StateIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return <Icon className={cn("size-7", className)} aria-hidden="true" />;
}

function LoadingState({
  title = "بنجهّز الحاجات...",
  description = "استنى شوية وهتلاقي كل حاجة جاهزة.",
  className,
}: Partial<StateProps>) {
  return (
    <StateFrame
      title={title}
      description={description}
      className={className}
      role="status"
      live="polite"
      icon={<Loader2 className="size-7 animate-spin" aria-hidden="true" />}
    />
  );
}

function EmptyState({
  title = "مفيش حاجة هنا",
  description = "لسه مفيش بيانات نعرضها.",
  action,
  icon,
  className,
}: Partial<StateProps>) {
  return (
    <StateFrame
      title={title}
      description={description}
      action={action}
      className={className}
      icon={icon ?? <StateIcon icon={Inbox} />}
    />
  );
}

function ErrorState({
  title = "حصلت مشكلة",
  description = "جرّب تاني، ولو المشكلة فضلت اتصل بالعيادة.",
  action,
  icon,
  className,
}: Partial<StateProps>) {
  return (
    <StateFrame
      title={title}
      description={description}
      action={action}
      className={cn("border-destructive/20", className)}
      role="alert"
      live="assertive"
      icon={icon ?? <StateIcon icon={AlertTriangle} className="text-destructive" />}
    />
  );
}

function SuccessState({
  title = "تم بنجاح",
  description,
  action,
  icon,
  className,
}: Partial<StateProps>) {
  return (
    <StateFrame
      title={title}
      description={description}
      action={action}
      className={className}
      role="status"
      live="polite"
      icon={icon ?? <StateIcon icon={CheckCircle2} className="text-primary" />}
    />
  );
}

export { EmptyState, ErrorState, LoadingState, SuccessState };
