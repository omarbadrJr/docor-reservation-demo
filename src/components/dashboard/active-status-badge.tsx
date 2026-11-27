import { PauseCircle, Stamp } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function ActiveStatusBadge({
  isActive,
  className,
}: {
  isActive: boolean;
  className?: string;
}) {
  if (isActive) {
    return (
      <Badge variant="default" className={className}>
        <Stamp className="size-3.5" aria-hidden="true" />
        نشط
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={className}>
      <PauseCircle className="size-3.5" aria-hidden="true" />
      غير نشط
    </Badge>
  );
}
