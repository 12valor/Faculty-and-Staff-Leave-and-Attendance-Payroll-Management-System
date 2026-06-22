import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  compact?: boolean;
  className?: string;
};

export function BrandMark({ compact = false, className }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <AccountBalanceRoundedIcon aria-hidden="true" fontSize="small" />
      </div>
      {compact ? null : (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">Faculty & Staff</p>
          <p className="truncate text-xs text-muted-foreground">Management System</p>
        </div>
      )}
    </div>
  );
}
