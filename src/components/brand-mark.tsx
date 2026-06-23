import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  compact?: boolean;
  className?: string;
};

export function BrandMark({ compact = false, className }: BrandMarkProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-card p-1.5 shadow-[0_6px_18px_rgb(127_29_29/0.1)]">
        <Image
          src="/images/tup-seal.png"
          alt="Technological University of the Philippines seal"
          width={48}
          height={48}
          className="size-full object-contain"
          priority
        />
      </div>
      {compact ? null : (
        <div className="min-w-0">
          <p className="truncate text-[0.9rem] font-bold tracking-[-0.015em] text-foreground">
            Faculty &amp; Staff
          </p>
          <p className="mt-0.5 truncate text-[0.7rem] font-medium text-muted-foreground">
            Management System
          </p>
        </div>
      )}
    </div>
  );
}
