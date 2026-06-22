import { Building2 } from "lucide-react";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  compact?: boolean;
  className?: string;
};

export function BrandMark({ compact = false, className }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Building2 aria-hidden="true" />
      </div>
      {compact ? null : (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            Faculty & Staff
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Management System
          </p>
        </div>
      )}
    </div>
  );
}
